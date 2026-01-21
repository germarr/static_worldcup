import json
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware

from app.routers import metrics

app = FastAPI(title="World Cup 2026 API")

# Cache settings
CACHE_DIR = Path(__file__).parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
HISTORY_CACHE_FILE = CACHE_DIR / "kalshi_history.json"
CACHE_MAX_AGE_HOURS = 6  # Refresh cache if older than this


# Kalshi API client (simplified from scripts/kalshi.py)
class KalshiClient:
    def __init__(self, base_url: str = "https://api.elections.kalshi.com/trade-api/v2"):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()

    def get_event(self, event_ticker: str) -> dict:
        url = f"{self.base_url}/events/{event_ticker.upper()}"
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_candlesticks(
        self,
        series_ticker: str,
        market_ticker: str,
        start_ts: int,
        end_ts: int,
        minutes: int = 1440,
    ) -> dict:
        """
        Fetch candlestick (OHLC) data for a specific market.

        Args:
            series_ticker: e.g., "KXMENWORLDCUP"
            market_ticker: e.g., "KXMENWORLDCUP-26-ARG"
            start_ts: Unix timestamp for start
            end_ts: Unix timestamp for end
            minutes: Candle interval (1, 60, or 1440 for daily)
        """
        url = (
            f"{self.base_url}/series/{series_ticker}/markets/{market_ticker}/candlesticks"
            f"?start_ts={start_ts}&end_ts={end_ts}&period_interval={minutes}"
        )

        delay_seconds = 5
        max_attempts = 5

        for attempt in range(1, max_attempts + 1):
            response = self.session.get(url, timeout=30)
            if response.status_code == 429:
                print(f"Rate limited (429) for {market_ticker}. Sleeping {delay_seconds}s (attempt {attempt}/{max_attempts})")
                time.sleep(delay_seconds)
                delay_seconds = min(delay_seconds * 2, 60)
                continue
            response.raise_for_status()
            return response.json()

        print(f"Rate limit retries exhausted for {market_ticker}")
        return {"candlesticks": []}


def get_kalshi_rankings(event_ticker: str = "kxmenworldcup-26") -> list[dict]:
    """Fetch current team rankings from Kalshi prediction market."""
    client = KalshiClient()

    payload = client.get_event(event_ticker)
    markets = payload.get("markets") or []

    if not markets:
        return []

    # Extract team data with current prices
    rankings = []
    for market in markets:
        team_name = market.get("yes_sub_title")
        # yes_bid is the current bid price in cents (probability %)
        yes_bid = market.get("yes_bid") or 0
        yes_ask = market.get("yes_ask") or 0
        last_price = market.get("last_price") or 0
        volume = market.get("volume") or 0

        rankings.append({
            "team_name": team_name,
            "yes_bid": yes_bid,  # cents = probability %
            "yes_ask": yes_ask,
            "last_price": last_price,
            "mid_price": round((yes_bid + yes_ask) / 2, 1) if yes_bid and yes_ask else last_price,
            "volume": volume,
        })

    # Sort by mid_price (implied probability) descending
    rankings.sort(key=lambda x: x["mid_price"], reverse=True)

    # Add rank
    for i, team in enumerate(rankings, 1):
        team["rank"] = i

    return rankings


def get_kalshi_history(
    event_ticker: str = "kxmenworldcup-26",
    days_back: int = 30,
    granularity: int = 1440,
    top_n_teams: Optional[int] = None,
) -> dict:
    """
    Fetch historical probability data for all teams.

    Args:
        event_ticker: Kalshi event ticker
        days_back: How many days of history to fetch
        granularity: Candle interval in minutes (1440=daily, 60=hourly)
        top_n_teams: If set, only fetch history for top N teams by current ranking
    """
    client = KalshiClient()

    # Get event info and markets
    payload = client.get_event(event_ticker)
    event_info = payload.get("event") or {}
    markets = payload.get("markets") or []

    if not markets:
        return {"teams": [], "history": []}

    series_ticker = (event_info.get("series_ticker") or "").upper()

    # Calculate time range
    end_ts = int(datetime.now(timezone.utc).timestamp())
    start_ts = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

    # Build list of teams with their tickers, sorted by current mid_price
    teams_data = []
    for market in markets:
        team_name = market.get("yes_sub_title")
        ticker = market.get("ticker")
        yes_bid = market.get("yes_bid") or 0
        yes_ask = market.get("yes_ask") or 0
        mid_price = round((yes_bid + yes_ask) / 2, 1) if yes_bid and yes_ask else (market.get("last_price") or 0)

        teams_data.append({
            "team_name": team_name,
            "ticker": ticker,
            "current_mid_price": mid_price,
        })

    # Sort by current price and optionally limit
    teams_data.sort(key=lambda x: x["current_mid_price"], reverse=True)
    if top_n_teams:
        teams_data = teams_data[:top_n_teams]

    # Fetch candlesticks for each team
    all_history = []
    for i, team in enumerate(teams_data):
        print(f"Fetching {team['team_name']} ({i+1}/{len(teams_data)})...")

        try:
            candles_response = client.get_candlesticks(
                series_ticker=series_ticker,
                market_ticker=team["ticker"],
                start_ts=start_ts,
                end_ts=end_ts,
                minutes=granularity,
            )
            candlesticks = candles_response.get("candlesticks") or []

            for candle in candlesticks:
                # Extract price data
                price_data = candle.get("price") or {}
                yes_bid_data = candle.get("yes_bid") or {}

                # Use close price as the probability for that period
                price_close = price_data.get("close")
                yes_bid_close = yes_bid_data.get("close")

                # Prefer yes_bid_close, fallback to price_close
                probability = yes_bid_close if yes_bid_close is not None else price_close

                if probability is not None:
                    all_history.append({
                        "team_name": team["team_name"],
                        "timestamp": candle.get("end_period_ts"),
                        "probability": probability,
                        "volume": candle.get("volume") or 0,
                    })

            # Small delay between requests to be nice to the API
            time.sleep(0.5)

        except Exception as e:
            print(f"Error fetching {team['team_name']}: {e}")
            continue

    # Sort history by timestamp
    all_history.sort(key=lambda x: (x["timestamp"], x["team_name"]))

    return {
        "teams": [t["team_name"] for t in teams_data],
        "history": all_history,
        "start_ts": start_ts,
        "end_ts": end_ts,
        "granularity": granularity,
    }


def load_cached_history() -> Optional[dict]:
    """Load history from cache file if it exists and is fresh."""
    if not HISTORY_CACHE_FILE.exists():
        return None

    try:
        with open(HISTORY_CACHE_FILE) as f:
            cached = json.load(f)

        # Check cache age
        cached_at = datetime.fromisoformat(cached.get("cached_at", "2000-01-01T00:00:00+00:00"))
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600

        if age_hours > CACHE_MAX_AGE_HOURS:
            print(f"Cache is {age_hours:.1f} hours old, needs refresh")
            return None

        print(f"Using cached history ({age_hours:.1f} hours old)")
        return cached

    except Exception as e:
        print(f"Error loading cache: {e}")
        return None


def save_history_cache(data: dict) -> None:
    """Save history data to cache file."""
    data["cached_at"] = datetime.now(timezone.utc).isoformat()
    with open(HISTORY_CACHE_FILE, "w") as f:
        json.dump(data, f)
    print(f"Saved history cache to {HISTORY_CACHE_FILE}")


def refresh_history_cache(event_ticker: str, days_back: int, top_n_teams: int) -> None:
    """Background task to refresh the history cache."""
    print("Starting background cache refresh...")
    try:
        history_data = get_kalshi_history(
            event_ticker=event_ticker,
            days_back=days_back,
            granularity=1440,  # Daily for efficiency
            top_n_teams=top_n_teams,
        )
        history_data["event_ticker"] = event_ticker.upper()
        save_history_cache(history_data)
        print("Background cache refresh complete")
    except Exception as e:
        print(f"Background cache refresh failed: {e}")


# Allow CORS from any origin (for local development with file://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(metrics.router)

DATA_DIR = Path(__file__).parent / "data"


def load_json(filename: str) -> list:
    with open(DATA_DIR / filename) as f:
        return json.load(f)


@app.get("/api/matches")
def get_matches():
    return load_json("matches.json")


@app.get("/api/teams")
def get_teams():
    return load_json("teams.json")


@app.get("/api/stadiums")
def get_stadiums():
    return load_json("stadiums.json")


@app.get("/api/kalshi-rankings")
def get_kalshi_rankings_endpoint(event_ticker: str = "kxmenworldcup-26"):
    """
    Fetch current World Cup team rankings from Kalshi prediction market.
    Returns teams sorted by implied win probability (mid_price).
    """
    try:
        rankings = get_kalshi_rankings(event_ticker)
        return {
            "event_ticker": event_ticker.upper(),
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "rankings": rankings,
        }
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch from Kalshi API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@app.get("/api/kalshi-history")
def get_kalshi_history_endpoint(
    background_tasks: BackgroundTasks,
    event_ticker: str = "kxmenworldcup-26",
    days_back: int = Query(default=30, ge=1, le=90),
    top_n_teams: int = Query(default=10, ge=1, le=48),
    force_refresh: bool = False,
):
    """
    Fetch historical probability data for World Cup teams.

    Returns cached data if available, triggers background refresh if cache is stale.

    Args:
        event_ticker: Kalshi event ticker
        days_back: Days of history (1-90)
        top_n_teams: Number of top teams to include (1-48)
        force_refresh: If true, fetch fresh data ignoring cache
    """
    try:
        # Calculate cutoff timestamp for filtering by days_back
        cutoff_ts = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

        # Try to load from cache first
        if not force_refresh:
            cached = load_cached_history()
            if cached:
                # Check if cache parameters match request
                cache_matches = (
                    cached.get("event_ticker") == event_ticker.upper()
                    and len(cached.get("teams", [])) >= top_n_teams
                )
                if cache_matches:
                    # Filter to requested number of teams AND date range
                    requested_teams = set(cached["teams"][:top_n_teams])
                    filtered_history = [
                        h for h in cached.get("history", [])
                        if h["team_name"] in requested_teams and h["timestamp"] >= cutoff_ts
                    ]
                    return {
                        "event_ticker": cached.get("event_ticker"),
                        "teams": list(requested_teams),
                        "history": filtered_history,
                        "cached_at": cached.get("cached_at"),
                        "from_cache": True,
                    }

        # No valid cache, fetch fresh data
        print("Fetching fresh history data...")
        history_data = get_kalshi_history(
            event_ticker=event_ticker,
            days_back=days_back,
            granularity=1440,  # Daily
            top_n_teams=top_n_teams,
        )

        # Save to cache
        history_data["event_ticker"] = event_ticker.upper()
        save_history_cache(history_data)

        # Filter history by cutoff timestamp (in case API returns extra data)
        filtered_history = [
            h for h in history_data["history"]
            if h["timestamp"] >= cutoff_ts
        ]

        return {
            "event_ticker": event_ticker.upper(),
            "teams": history_data["teams"],
            "history": filtered_history,
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "from_cache": False,
        }

    except requests.RequestException as e:
        # If API fails, try to return stale cache
        cached = load_cached_history()
        if cached:
            return {
                **cached,
                "from_cache": True,
                "warning": f"Using stale cache due to API error: {str(e)}",
            }
        raise HTTPException(status_code=502, detail=f"Failed to fetch from Kalshi API: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
