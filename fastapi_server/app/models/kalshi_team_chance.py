"""
Kalshi Team Chances - Simplified time-series data for quick queries.
This is a lighter-weight version of KalshiCandlestick for common operations.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class KalshiTeamChance(SQLModel, table=True):
    __tablename__ = "kalshi_team_chances"
    __table_args__ = (
        UniqueConstraint("market_ticker", "end_period_ts", name="uq_chance_market_ts"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    team_id: Optional[int] = Field(default=None, foreign_key="fifa_teams.id")
    team_name: str = Field(index=True)
    event_ticker: str = Field(index=True)
    series_ticker: Optional[str] = None
    market_ticker: str = Field(index=True)

    # Time
    end_period_ts: int = Field(index=True)  # Unix timestamp
    end_period_utc: datetime

    # Key price data (in cents)
    yes_bid_open: Optional[int] = None
    yes_ask_close: Optional[int] = None
    mid_cents: Optional[float] = None

    # Volume
    volume: Optional[int] = None
    open_interest: Optional[int] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
