"""
Database engine and session management.
"""
from sqlmodel import Session, SQLModel, create_engine

from app.config import DATABASE_URL

# Use check_same_thread only for SQLite
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def create_db_and_tables():
    """Create all tables defined in SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Yield a database session."""
    with Session(engine) as session:
        yield session
