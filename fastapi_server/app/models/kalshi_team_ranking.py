"""
Kalshi Team Rankings - Point-in-time snapshots of team probabilities.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class KalshiTeamRanking(SQLModel, table=True):
    __tablename__ = "kalshi_team_rankings"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_ticker: str = Field(index=True)
    series_ticker: Optional[str] = None
    team_name: str = Field(index=True)
    team_id: Optional[int] = Field(default=None, foreign_key="fifa_teams.id")

    # Average probability from candlestick data (in cents, 0-100)
    avg_yes_bid_open: Optional[float] = None

    # Ranking position
    rank: int

    as_of: datetime = Field(index=True)  # Snapshot timestamp
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
