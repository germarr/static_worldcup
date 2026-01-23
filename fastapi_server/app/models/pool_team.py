"""
Pool Teams - Team prediction pools that friends can join.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class PoolTeam(SQLModel, table=True):
    __tablename__ = "pool_teams"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)  # "wc26-xk92m4pq" (12 chars)
    name: str = Field(max_length=50)
    creator_token_hash: str  # SHA-256 hash for admin operations
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
