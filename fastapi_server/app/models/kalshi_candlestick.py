"""
Kalshi Candlesticks - Full time-series history with OHLC data.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel, UniqueConstraint


class KalshiCandlestick(SQLModel, table=True):
    __tablename__ = "kalshi_candlesticks"
    __table_args__ = (
        UniqueConstraint("market_ticker", "end_period_ts", "granularity_minutes"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    market_ticker: str = Field(index=True)
    event_ticker: str = Field(index=True)
    team_name: str = Field(index=True)
    team_id: Optional[int] = Field(default=None, foreign_key="fifa_teams.id")

    # Time
    end_period_ts: int = Field(index=True)  # Unix timestamp
    end_period_utc: datetime
    granularity_minutes: int  # 1, 60, or 1440

    # OHLC prices (in cents)
    price_open: Optional[int] = None
    price_high: Optional[int] = None
    price_low: Optional[int] = None
    price_close: Optional[int] = None

    # Yes bid OHLC (in cents)
    yes_bid_open: Optional[int] = None
    yes_bid_high: Optional[int] = None
    yes_bid_low: Optional[int] = None
    yes_bid_close: Optional[int] = None

    # Yes ask OHLC (in cents)
    yes_ask_open: Optional[int] = None
    yes_ask_high: Optional[int] = None
    yes_ask_low: Optional[int] = None
    yes_ask_close: Optional[int] = None

    # Derived (computed on insert)
    mid_cents: Optional[float] = None
    spread_cents: Optional[float] = None

    # Volume
    volume: Optional[int] = None
    open_interest: Optional[int] = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
