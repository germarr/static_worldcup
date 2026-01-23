"""
Teams router - API endpoints for prediction pool teams.

Allows users to create teams, join teams, and manage their brackets.
Privacy-first: no accounts required, only tokens for updates.
"""
import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.database import get_session
from app.models.pool_team import PoolTeam
from app.models.pool_member import PoolMember

router = APIRouter(prefix="/api/teams", tags=["teams"])


# --- Request/Response Models ---

class CreateTeamRequest(BaseModel):
    name: str = Field(min_length=1, max_length=50, description="Team name")
    creator_name: str = Field(min_length=1, max_length=30, description="Creator's display name")
    bracket_data: str = Field(min_length=1, max_length=500, description="Compressed bracket data")


class CreateTeamResponse(BaseModel):
    code: str
    name: str
    creator_token: str  # Returned only once, user must save it
    member_token: str  # Token for the creator's membership


class JoinTeamRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=30, description="Display name in team")
    bracket_data: str = Field(min_length=1, max_length=500, description="Compressed bracket data")


class JoinTeamResponse(BaseModel):
    member_token: str  # Returned only once, user must save it
    team_name: str
    team_code: str


class UpdateBracketRequest(BaseModel):
    bracket_data: str = Field(min_length=1, max_length=500, description="Compressed bracket data")


class MemberInfo(BaseModel):
    display_name: str
    bracket_data: str
    joined_at: str
    updated_at: str


class TeamResponse(BaseModel):
    code: str
    name: str
    created_at: str
    members: list[MemberInfo]


# --- Utility Functions ---

def generate_team_code() -> str:
    """Generate a unique team code like 'wc26-xk92m4pq'."""
    random_part = secrets.token_hex(4)  # 8 hex chars = 32 bits entropy
    return f"wc26-{random_part}"


def generate_token() -> str:
    """Generate a secure token for auth."""
    return secrets.token_urlsafe(24)  # ~192 bits entropy


def hash_token(token: str) -> str:
    """Hash a token for storage using SHA-256."""
    return hashlib.sha256(token.encode()).hexdigest()


def verify_token(provided_token: str, stored_hash: str) -> bool:
    """Verify a token against its stored hash."""
    return hash_token(provided_token) == stored_hash


# --- Endpoints ---

@router.post("", response_model=CreateTeamResponse)
def create_team(
    request: CreateTeamRequest,
    session: Session = Depends(get_session),
):
    """
    Create a new prediction pool team.

    Returns the team code (shareable) and creator token (must be saved for admin ops).
    The creator is automatically added as the first member.
    """
    # Generate unique code (with retry for extremely rare collisions)
    for _ in range(5):
        code = generate_team_code()
        existing = session.exec(
            select(PoolTeam).where(PoolTeam.code == code)
        ).first()
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to generate unique team code")

    # Generate tokens
    creator_token = generate_token()
    member_token = generate_token()

    # Create team
    team = PoolTeam(
        code=code,
        name=request.name.strip(),
        creator_token_hash=hash_token(creator_token),
    )
    session.add(team)
    session.commit()
    session.refresh(team)

    # Add creator as first member
    member = PoolMember(
        team_id=team.id,
        display_name=request.creator_name.strip(),
        bracket_data=request.bracket_data,
        member_token_hash=hash_token(member_token),
    )
    session.add(member)
    session.commit()

    return CreateTeamResponse(
        code=code,
        name=team.name,
        creator_token=creator_token,
        member_token=member_token,
    )


@router.get("/{code}", response_model=TeamResponse)
def get_team(
    code: str,
    limit: int = Query(default=50, ge=1, le=100, description="Max members to return"),
    session: Session = Depends(get_session),
):
    """
    Get team details and all members.

    Anyone with the team code can view this (codes are unguessable).
    """
    team = session.exec(
        select(PoolTeam).where(PoolTeam.code == code)
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Get members, ordered by joined_at
    members = session.exec(
        select(PoolMember)
        .where(PoolMember.team_id == team.id)
        .order_by(PoolMember.joined_at)
        .limit(limit)
    ).all()

    return TeamResponse(
        code=team.code,
        name=team.name,
        created_at=team.created_at.isoformat(),
        members=[
            MemberInfo(
                display_name=m.display_name,
                bracket_data=m.bracket_data,
                joined_at=m.joined_at.isoformat(),
                updated_at=m.updated_at.isoformat(),
            )
            for m in members
        ],
    )


@router.post("/{code}/join", response_model=JoinTeamResponse)
def join_team(
    code: str,
    request: JoinTeamRequest,
    session: Session = Depends(get_session),
):
    """
    Join an existing team.

    Returns a member token that must be saved for future updates.
    Display name must be unique within the team.
    """
    team = session.exec(
        select(PoolTeam).where(PoolTeam.code == code)
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check for duplicate display name
    display_name = request.display_name.strip()
    existing_member = session.exec(
        select(PoolMember)
        .where(PoolMember.team_id == team.id)
        .where(PoolMember.display_name == display_name)
    ).first()

    if existing_member:
        raise HTTPException(
            status_code=409,
            detail=f"Display name '{display_name}' is already taken in this team"
        )

    # Generate member token
    member_token = generate_token()

    # Create member
    member = PoolMember(
        team_id=team.id,
        display_name=display_name,
        bracket_data=request.bracket_data,
        member_token_hash=hash_token(member_token),
    )
    session.add(member)
    session.commit()

    return JoinTeamResponse(
        member_token=member_token,
        team_name=team.name,
        team_code=team.code,
    )


@router.put("/{code}/members/{display_name}")
def update_member_bracket(
    code: str,
    display_name: str,
    request: UpdateBracketRequest,
    x_member_token: Optional[str] = Header(None, alias="X-Member-Token"),
    session: Session = Depends(get_session),
):
    """
    Update a member's bracket data.

    Requires the member's token in the X-Member-Token header.
    """
    if not x_member_token:
        raise HTTPException(status_code=401, detail="X-Member-Token header required")

    team = session.exec(
        select(PoolTeam).where(PoolTeam.code == code)
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    member = session.exec(
        select(PoolMember)
        .where(PoolMember.team_id == team.id)
        .where(PoolMember.display_name == display_name)
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Verify token
    if not verify_token(x_member_token, member.member_token_hash):
        raise HTTPException(status_code=403, detail="Invalid member token")

    # Update bracket
    member.bracket_data = request.bracket_data
    member.updated_at = datetime.now(timezone.utc)
    session.add(member)
    session.commit()

    return {"message": "Bracket updated successfully"}


@router.delete("/{code}/members/{display_name}")
def leave_team(
    code: str,
    display_name: str,
    x_member_token: Optional[str] = Header(None, alias="X-Member-Token"),
    session: Session = Depends(get_session),
):
    """
    Remove a member from the team (leave team).

    Requires the member's token in the X-Member-Token header.
    """
    if not x_member_token:
        raise HTTPException(status_code=401, detail="X-Member-Token header required")

    team = session.exec(
        select(PoolTeam).where(PoolTeam.code == code)
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    member = session.exec(
        select(PoolMember)
        .where(PoolMember.team_id == team.id)
        .where(PoolMember.display_name == display_name)
    ).first()

    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Verify token
    if not verify_token(x_member_token, member.member_token_hash):
        raise HTTPException(status_code=403, detail="Invalid member token")

    session.delete(member)
    session.commit()

    return {"message": "Successfully left the team"}


@router.delete("/{code}")
def delete_team(
    code: str,
    x_creator_token: Optional[str] = Header(None, alias="X-Creator-Token"),
    session: Session = Depends(get_session),
):
    """
    Delete a team and all its members.

    Requires the creator's token in the X-Creator-Token header.
    """
    if not x_creator_token:
        raise HTTPException(status_code=401, detail="X-Creator-Token header required")

    team = session.exec(
        select(PoolTeam).where(PoolTeam.code == code)
    ).first()

    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Verify creator token
    if not verify_token(x_creator_token, team.creator_token_hash):
        raise HTTPException(status_code=403, detail="Invalid creator token")

    # Delete all members first
    members = session.exec(
        select(PoolMember).where(PoolMember.team_id == team.id)
    ).all()
    for member in members:
        session.delete(member)

    # Delete team
    session.delete(team)
    session.commit()

    return {"message": "Team deleted successfully"}
