import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
try:
    from .database import engine, Base, SessionLocal
    from .models import User, AllowedEmail
    from .routes import auth, admin, attendance
except (ImportError, ValueError):
    from app.database import engine, Base, SessionLocal
    from app.models import User, AllowedEmail
    from app.routes import auth, admin, attendance

# Create database tables
Base.metadata.create_all(bind=engine)

def migrate_db():
    """Ensure newly added columns exist in existing database tables."""
    from sqlalchemy import text
    with engine.connect() as conn:
        # Check and add columns to attendance_records
        for col_name, col_type in [
            ("latitude", "FLOAT"),
            ("longitude", "FLOAT"),
            ("distance_meters", "FLOAT")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE attendance_records ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass # Column already exists
        
        # Check and add columns to user_devices
        for col_name, col_type in [
            ("device_name", "VARCHAR"),
            ("user_agent", "TEXT"),
            ("ip_address", "VARCHAR"),
            ("is_linked", "BOOLEAN DEFAULT 1"),
            ("first_linked_at", "DATETIME"),
            ("last_login_at", "DATETIME")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE user_devices ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

        # Check and add columns to users
        for col_name, col_type in [
            ("hashed_password", "VARCHAR"),
            ("is_approved", "BOOLEAN DEFAULT 1")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

        # Check and add columns to allowed_emails
        for col_name, col_type in [
            ("admin_id", "INTEGER")
        ]:
            try:
                conn.execute(text(f"ALTER TABLE allowed_emails ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass

        # Purge any legacy attendance records belonging to Admin accounts
        try:
            conn.execute(text("DELETE FROM attendance_records WHERE user_id IN (SELECT id FROM users WHERE role = 'ADMIN')"))
            conn.execute(text("DELETE FROM allowed_emails WHERE lower(email) IN (SELECT lower(email) FROM users WHERE role = 'ADMIN')"))
            initial_admin = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
            if initial_admin:
                conn.execute(text(f"DELETE FROM allowed_emails WHERE lower(email) = '{initial_admin}'"))
            conn.commit()
        except Exception:
            pass

migrate_db()

def seed_initial_admin():
    """Ensure master administrator user account exists."""
    initial_admin = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    if initial_admin and "@" in initial_admin:
        db = SessionLocal()
        try:
            exists = db.query(User).filter(User.email == initial_admin).first()
            if not exists:
                import uuid
                admin_user = User(
                    email=initial_admin,
                    full_name="Master Administrator",
                    role="ADMIN",
                    google_id=str(uuid.uuid4())
                )
                db.add(admin_user)
                db.commit()
        except Exception as e:
            print("Error seeding initial admin:", e)
        finally:
            db.close()

seed_initial_admin()

app = FastAPI(title="OTP Attendance API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(attendance.router, prefix="/api")

# Mount frontend static files
frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'frontend', 'dist')

if os.path.isdir(frontend_dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")

    # Explicit favicon and root asset handlers
    @app.get("/favicon.ico", include_in_schema=False)
    def serve_favicon_ico():
        ico_path = os.path.join(frontend_dist_path, "favicon.ico")
        if os.path.isfile(ico_path):
            return FileResponse(ico_path, media_type="image/x-icon")
        return {"detail": "Not Found"}

    @app.get("/favicon.png", include_in_schema=False)
    def serve_favicon_png():
        png_path = os.path.join(frontend_dist_path, "favicon.png")
        if os.path.isfile(png_path):
            return FileResponse(png_path, media_type="image/png")
        return {"detail": "Not Found"}

    @app.get("/favicon.svg", include_in_schema=False)
    def serve_favicon_svg():
        svg_path = os.path.join(frontend_dist_path, "favicon.svg")
        if os.path.isfile(svg_path):
            return FileResponse(svg_path, media_type="image/svg+xml")
        return {"detail": "Not Found"}

    @app.get("/logo.png", include_in_schema=False)
    def serve_logo_png():
        logo_path = os.path.join(frontend_dist_path, "logo.png")
        if os.path.isfile(logo_path):
            return FileResponse(logo_path, media_type="image/png")
        return {"detail": "Not Found"}

    @app.get("/manifest.json", include_in_schema=False)
    def serve_manifest():
        manifest_path = os.path.join(frontend_dist_path, "manifest.json")
        if os.path.isfile(manifest_path):
            return FileResponse(manifest_path, media_type="application/json")
        return {"detail": "Not Found"}

    # Catch-all route to serve static files from dist or fallback to React's index.html
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Prevent the catch-all from interfering with non-existent /api routes
        if catchall.startswith("api/"):
            return {"detail": "Not Found"}
        
        # Check if the requested file exists in dist (e.g. apple-touch-icon.png, logo-192.png)
        file_path = os.path.join(frontend_dist_path, catchall)
        if catchall and os.path.isfile(file_path):
            return FileResponse(file_path)

        response = FileResponse(os.path.join(frontend_dist_path, "index.html"))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to the OTP Attendance System API (Frontend build not found)"}

