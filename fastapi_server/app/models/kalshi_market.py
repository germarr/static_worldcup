"""
Kalshi Markets reference table.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class KalshiMarket(SQLModel, table=True):
    __tablename__ = "kalshi_markets"

    id: Optional[int] = Field(default=None, primary_key=True)
    market_ticker: str = Field(index=True, unique=True)  # e.g., "KXMENWORLDCUP-26-ARG"
    event_ticker: str = Field(foreign_key="kalshi_events.event_ticker", index=True)
    team_name: str = Field(index=True)
    team_id: Optional[int] = Field(default=None, foreign_key="fifa_teams.id")
    open_time: datetime
    close_time: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
