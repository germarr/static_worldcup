"""
Quick test script to verify Azure PostgreSQL database connection.
"""
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def test_connection():
    """Test database connection using psycopg2."""
    try:
        import psycopg2
    except ImportError:
        print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
        return False

    host = os.getenv("PGHOST")
    user = os.getenv("PGUSER")
    port = os.getenv("PGPORT", "5432")
    database = os.getenv("PGDATABASE")
    password = os.getenv("PGPASSWORD")

    if not all([host, user, database, password]):
        print("Error: Missing required environment variables.")
        print(f"  PGHOST: {'set' if host else 'MISSING'}")
        print(f"  PGUSER: {'set' if user else 'MISSING'}")
        print(f"  PGPORT: {port}")
        print(f"  PGDATABASE: {'set' if database else 'MISSING'}")
        print(f"  PGPASSWORD: {'set' if password else 'MISSING'}")
        return False

    if password == "{your-password}":
        print("Error: Please replace {your-password} in .env with your actual password.")
        return False

    print(f"Connecting to PostgreSQL at {host}:{port}/{database}...")

    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            port=port,
            database=database,
            password=password,
            sslmode="require"  # Azure requires SSL
        )

        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]

        print("Connection successful!")
        print(f"PostgreSQL version: {version}")

        cursor.close()
        conn.close()
        return True

    except psycopg2.OperationalError as e:
        print(f"Connection failed: {e}")
        return False


def test_sqlmodel_connection():
    """Test database connection using SQLModel (SQLAlchemy)."""
    try:
        from sqlmodel import create_engine, text
    except ImportError:
        print("Error: sqlmodel not installed. Run: pip install sqlmodel")
        return False

    host = os.getenv("PGHOST")
    user = os.getenv("PGUSER")
    port = os.getenv("PGPORT", "5432")
    database = os.getenv("PGDATABASE")
    password = os.getenv("PGPASSWORD")

    if password == "{your-password}":
        print("Error: Please replace {your-password} in .env with your actual password.")
        return False

    # SQLAlchemy connection string for PostgreSQL
    # Format: postgresql://user:password@host:port/database
    database_url = f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode=require"

    print(f"Testing SQLModel connection to {host}:{port}/{database}...")

    try:
        engine = create_engine(database_url, echo=False)

        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();"))
            version = result.fetchone()[0]

        print("SQLModel connection successful!")
        print(f"PostgreSQL version: {version}")
        return True

    except Exception as e:
        print(f"SQLModel connection failed: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Azure PostgreSQL Connection Test")
    print("=" * 60)
    print()

    print("Test 1: psycopg2 connection")
    print("-" * 40)
    psycopg_ok = test_connection()
    print()

    print("Test 2: SQLModel (SQLAlchemy) connection")
    print("-" * 40)
    sqlmodel_ok = test_sqlmodel_connection()
    print()

    print("=" * 60)
    if psycopg_ok and sqlmodel_ok:
        print("All connection tests passed!")
    else:
        print("Some tests failed. Check your credentials and network.")
    print("=" * 60)
