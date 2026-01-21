"""
Seed the fifa_teams table from data/teams.json.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlmodel import Session, select

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(PROJECT_ROOT))

from app.database import create_db_and_tables, engine
from app.models.fifa_team import FifaTeam


def load_teams_from_json(json_path: Path) -> list[dict]:
    """Load team data from JSON file."""
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_teams(json_path: Path | None = None) -> int:
    """
    Seed fifa_teams table from JSON file.
    Returns the number of teams inserted/updated.
    """
    if json_path is None:
        json_path = PROJECT_ROOT / "data" / "teams.json"

    teams_data = load_teams_from_json(json_path)
    count = 0

    with Session(engine) as session:
        for team in teams_data:
            existing = session.exec(
                select(FifaTeam).where(FifaTeam.id == team["id"])
            ).first()

            if existing:
                existing.name = team["name"]
                existing.country_code = team["country_code"]
                existing.group_letter = team.get("group_letter")
                existing.flag_url = team.get("flag_emoji")
                existing.updated_at = datetime.now(timezone.utc)
                session.add(existing)
            else:
                new_team = FifaTeam(
                    id=team["id"],
                    name=team["name"],
                    country_code=team["country_code"],
                    group_letter=team.get("group_letter"),
                    flag_url=team.get("flag_emoji"),
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(new_team)
            count += 1

        session.commit()

    return count


def main():
    print("Creating database tables...")
    create_db_and_tables()

    print("Seeding fifa_teams from data/teams.json...")
    count = seed_teams()
    print(f"Done! {count} teams seeded.")


if __name__ == "__main__":
    main()
