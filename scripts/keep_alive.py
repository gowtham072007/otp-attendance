import os
import sys
from dotenv import load_dotenv

# Load env variables
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
load_dotenv(os.path.join(backend_dir, ".env"))
load_dotenv()

def ping_database():
    print("[KEEP-ALIVE] Connecting to database...")
    try:
        sys.path.insert(0, backend_dir)
        from app.database import engine
        from sqlalchemy import text

        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;")).scalar()
            print(f"[KEEP-ALIVE] Success! Executed 'SELECT 1;', result={result}")
            return True
    except Exception as e:
        print(f"[KEEP-ALIVE] Error pinging database: {e}")
        return False

if __name__ == "__main__":
    success = ping_database()
    sys.exit(0 if success else 1)
