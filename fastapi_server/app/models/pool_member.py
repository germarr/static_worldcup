"""
Pool Members - Members of prediction pools with their bracket data.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class PoolMember(SQLModel, table=True):
    __tablename__ = "pool_members"
    __table_args__ = (
        UniqueConstraint("team_id", "display_name", name="uq_team_display_name"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="pool_teams.id", index=True)
    display_name: str = Field(max_length=30)
    bracket_data: str = Field(max_length=500)  # Compressed base64 (~200-280 bytes)
    member_token_hash: str = Field(index=True)  # For updates
    joined_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
