"""
FIFA Teams reference table.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class FifaTeam(SQLModel, table=True):
    __tablename__ = "fifa_teams"

    id: int = Field(primary_key=True)
    name: str = Field(index=True, unique=True)
    country_code: str
    group_letter: Optional[str] = None
    flag_url: Optional[str] = Field(default=None, alias="flag_emoji")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
