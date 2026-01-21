"""
Kalshi Events reference table.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class KalshiEvent(SQLModel, table=True):
    __tablename__ = "kalshi_events"

    id: Optional[int] = Field(default=None, primary_key=True)
    event_ticker: str = Field(index=True, unique=True)  # e.g., "KXMENWORLDCUP-26"
    series_ticker: str  # e.g., "KXMENWORLDCUP"
    title: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
