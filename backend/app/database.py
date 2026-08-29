import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# We expect a Postgres URL. If none provided, we fallback to SQLite for local quick dev or Vercel /tmp storage.
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if not raw_db_url or raw_db_url.startswith("sqlite"):
    if os.getenv("VERCEL"):
        SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/attendance.db"
    else:
        SQLALCHEMY_DATABASE_URL = "sqlite:///./attendance.db"
else:
    import re
    import urllib.parse
    # Remove accidental template brackets e.g. [my-password] -> my-password
    raw_db_url = re.sub(r'\[([^\]]+)\]', r'\1', raw_db_url)
    
    # Remove sslmode query parameter as pg8000 uses native SSL
    parsed = urllib.parse.urlparse(raw_db_url)
    if parsed.query:
        queries = urllib.parse.parse_qs(parsed.query)
        queries.pop('sslmode', None)
        new_query = urllib.parse.urlencode(queries, doseq=True)
        raw_db_url = urllib.parse.urlunparse(parsed._replace(query=new_query))

    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql+pg8000://", 1)
    elif raw_db_url.startswith("postgresql://") and not any(d in raw_db_url for d in ["+pg8000", "+psycopg", "+asyncpg"]):
        raw_db_url = raw_db_url.replace("postgresql://", "postgresql+pg8000://", 1)
    SQLALCHEMY_DATABASE_URL = raw_db_url

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
