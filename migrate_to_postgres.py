"""
Migration script: SQLite -> PostgreSQL

Usage:
    1. Set POSTGRES_URL in this script (or as env var)
    2. Make sure the SQLite database exists at backend/instance/schedule.db
    3. Run: python migrate_to_postgres.py

The script copies all data from SQLite to PostgreSQL preserving IDs.
Run only once on an empty PostgreSQL database.
"""

import os
import sys

SQLITE_URL = "sqlite:///backend/instance/schedule.db"
POSTGRES_URL = os.environ.get("POSTGRES_URL") or input("PostgreSQL URL (e.g. postgresql://user:pass@localhost/work_calendar): ").strip()

if not POSTGRES_URL.startswith("postgresql"):
    print("ERROR: Invalid PostgreSQL URL.")
    sys.exit(1)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

print("Connecting to databases...")
sqlite_engine = create_engine(SQLITE_URL)
pg_engine = create_engine(POSTGRES_URL)

# Tables to migrate in order (respects foreign key dependencies)
TABLES = [
    "departments",
    "labels",
    "positions",
    "users",
    "shifts",
    "requests",
    "notifications",
    "announcements",
    "announcement_reads",
    "audit_logs",
    "login_attempts",
]

def migrate():
    # Create all tables in PostgreSQL using the app models
    sys.path.insert(0, "backend")
    os.environ["DATABASE_URL"] = POSTGRES_URL
    from app import create_app
    app = create_app()

    with app.app_context():
        print("Tables created in PostgreSQL.")

    with sqlite_engine.connect() as src, pg_engine.connect() as dst:
        for table in TABLES:
            try:
                rows = src.execute(text(f"SELECT * FROM {table}")).mappings().all()
            except Exception:
                print(f"  Skipping {table} (not found in SQLite)")
                continue

            if not rows:
                print(f"  {table}: empty, skipping")
                continue

            count = 0
            for row in rows:
                cols = ", ".join(row.keys())
                placeholders = ", ".join(f":{k}" for k in row.keys())
                stmt = text(f"INSERT INTO {table} ({cols}) VALUES ({placeholders}) ON CONFLICT DO NOTHING")
                dst.execute(stmt, dict(row))
                count += 1

            dst.commit()
            print(f"  {table}: {count} rows migrated")

    print("\nMigration complete.")
    print("Update DATABASE_URL in your .env to point to PostgreSQL and restart the app.")

if __name__ == "__main__":
    migrate()
