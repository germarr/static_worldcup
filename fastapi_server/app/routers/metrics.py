"""
Metrics router - serves Kalshi prediction market data from PostgreSQL.

All data is read from the database, populated by scripts/kalshi.py.
"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, func, select

from app.database import get_session
from app.models.kalshi_team_chance import KalshiTeamChance
from app.models.kalshi_team_ranking import KalshiTeamRanking

router = APIRouter(prefix="/api/metrics", tags=["metrics"])


@router.get("/rankings")
def get_rankings(
    event_ticker: str = "kxmenworldcup-26",
    session: Session = Depends(get_session),
):
    """
    Get current team rankings from the database.

    Returns teams sorted by rank (derived from avg_yes_bid_open probability),
    with current bid/ask/volume from the latest KalshiTeamChance records.
    """
    statement = (
        select(KalshiTeamRanking)
        .where(KalshiTeamRanking.event_ticker == event_ticker.upper())
        .order_by(KalshiTeamRanking.rank)
    )
    results = session.exec(statement).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No rankings found for event {event_ticker}. Run the ETL script first.",
        )

    as_of = results[0].as_of if results else None

    # Get latest KalshiTeamChance per team for bid/ask/volume
    # Subquery to find max timestamp per team
    max_ts_subq = (
        select(
            KalshiTeamChance.team_name,
            func.max(KalshiTeamChance.end_period_ts).label("max_ts"),
        )
        .where(KalshiTeamChance.event_ticker == event_ticker.upper())
        .group_by(KalshiTeamChance.team_name)
        .subquery()
    )

    # Get the actual records with the max timestamp
    latest_chances_stmt = (
        select(KalshiTeamChance)
        .join(
            max_ts_subq,
            (KalshiTeamChance.team_name == max_ts_subq.c.team_name)
            & (KalshiTeamChance.end_period_ts == max_ts_subq.c.max_ts),
        )
        .where(KalshiTeamChance.event_ticker == event_ticker.upper())
    )
    latest_chances = session.exec(latest_chances_stmt).all()

    # Create lookup dict for bid/ask/volume
    chance_lookup = {c.team_name: c for c in latest_chances}

    rankings = []
    for r in results:
        chance = chance_lookup.get(r.team_name)
        rankings.append(
            {
                "team_name": r.team_name,
                "probability": r.avg_yes_bid_open,
                "rank": r.rank,
                "team_id": r.team_id,
                "yes_bid": chance.yes_bid_open if chance else None,
                "yes_ask": chance.yes_ask_close if chance else None,
                "volume": chance.volume if chance else None,
            }
        )

    return {
        "event_ticker": event_ticker.upper(),
        "as_of": as_of.isoformat() if as_of else None,
        "rankings": rankings,
    }


@router.get("/history")
def get_history(
    event_ticker: str = "kxmenworldcup-26",
    days_back: int = Query(default=30, ge=1, le=90),
    top_n_teams: int = Query(default=10, ge=1, le=48),
    session: Session = Depends(get_session),
):
    """
    Get historical probability data for top N teams.

    Data is read from kalshi_team_chances table (populated by ETL script).
    """
    cutoff_ts = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

    # Get top N teams by rank
    top_teams_stmt = (
        select(KalshiTeamRanking.team_name)
        .where(KalshiTeamRanking.event_ticker == event_ticker.upper())
        .order_by(KalshiTeamRanking.rank)
        .limit(top_n_teams)
    )
    top_teams = session.exec(top_teams_stmt).all()

    if not top_teams:
        raise HTTPException(
            status_code=404,
            detail=f"No rankings found for event {event_ticker}. Run the ETL script first.",
        )

    # Get historical data for those teams
    history_stmt = (
        select(KalshiTeamChance)
        .where(KalshiTeamChance.event_ticker == event_ticker.upper())
        .where(KalshiTeamChance.end_period_ts >= cutoff_ts)
        .where(KalshiTeamChance.team_name.in_(top_teams))
        .order_by(KalshiTeamChance.end_period_ts, KalshiTeamChance.team_name)
    )
    results = session.exec(history_stmt).all()

    history = [
        {
            "team_name": r.team_name,
            "timestamp": r.end_period_ts,
            "probability": r.yes_bid_open,
            "bid": r.yes_bid_open,
            "ask": r.yes_ask_close,
            "mid": r.mid_cents,
            "volume": r.volume,
        }
        for r in results
    ]

    # Calculate data range
    data_from = datetime.fromtimestamp(cutoff_ts, tz=timezone.utc).isoformat()
    data_to = datetime.now(timezone.utc).isoformat()

    return {
        "event_ticker": event_ticker.upper(),
        "teams": list(top_teams),
        "history": history,
        "data_from": data_from,
        "data_to": data_to,
    }


@router.get("/teams/{team_name}")
def get_team_history(
    team_name: str,
    event_ticker: str = "kxmenworldcup-26",
    days_back: int = Query(default=30, ge=1, le=90),
    session: Session = Depends(get_session),
):
    """
    Get historical probability data for a single team.
    """
    cutoff_ts = int((datetime.now(timezone.utc) - timedelta(days=days_back)).timestamp())

    # Get team history
    statement = (
        select(KalshiTeamChance)
        .where(KalshiTeamChance.event_ticker == event_ticker.upper())
        .where(KalshiTeamChance.team_name == team_name)
        .where(KalshiTeamChance.end_period_ts >= cutoff_ts)
        .order_by(KalshiTeamChance.end_period_ts)
    )
    results = session.exec(statement).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail=f"No history found for team '{team_name}' in event {event_ticker}.",
        )

    history = [
        {
            "timestamp": r.end_period_ts,
            "probability": r.yes_bid_open,
            "volume": r.volume,
        }
        for r in results
    ]

    # Get current ranking
    ranking_stmt = (
        select(KalshiTeamRanking)
        .where(KalshiTeamRanking.event_ticker == event_ticker.upper())
        .where(KalshiTeamRanking.team_name == team_name)
    )
    ranking = session.exec(ranking_stmt).first()

    return {
        "event_ticker": event_ticker.upper(),
        "team_name": team_name,
        "current_rank": ranking.rank if ranking else None,
        "current_probability": ranking.avg_yes_bid_open if ranking else None,
        "history": history,
        "data_from": datetime.fromtimestamp(cutoff_ts, tz=timezone.utc).isoformat(),
        "data_to": datetime.now(timezone.utc).isoformat(),
    }
