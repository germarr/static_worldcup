"""
Database configuration - loads DATABASE_URL from environment variables.
"""
import os
from dotenv import load_dotenv

load_dotenv()

PGHOST = os.getenv("PGHOST")
PGUSER = os.getenv("PGUSER")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE")
PGPASSWORD = os.getenv("PGPASSWORD")

if all([PGHOST, PGUSER, PGDATABASE, PGPASSWORD]):
    DATABASE_URL = (
        f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}?sslmode=require"
    )
else:
    DATABASE_URL = "sqlite:///./data/worldcup.db"
