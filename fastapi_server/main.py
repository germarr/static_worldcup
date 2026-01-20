import json
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="World Cup 2026 API")

# Allow CORS from any origin (for local development with file://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
