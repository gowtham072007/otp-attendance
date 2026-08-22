import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from .database import engine, Base, SessionLocal
from .models import AllowedEmail
from .routes import auth, admin, attendance

# Create database tables
Base.metadata.create_all(bind=engine)

def seed_initial_admin():
    initial_admin = os.getenv("INITIAL_ADMIN_EMAIL", "").strip().lower()
    if initial_admin and "@" in initial_admin:
        db = SessionLocal()
        try:
            exists = db.query(AllowedEmail).filter(AllowedEmail.email == initial_admin).first()
            if not exists:
                admin_entry = AllowedEmail(email=initial_admin, name="Administrator")
                db.add(admin_entry)
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

    # Catch-all route to serve React's index.html for client-side routing
    @app.get("/{catchall:path}")
    def serve_frontend(catchall: str):
        # Prevent the catch-all from interfering with non-existent /api routes
        if catchall.startswith("api/"):
            return {"detail": "Not Found"}
        response = FileResponse(os.path.join(frontend_dist_path, "index.html"))
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
else:
    @app.get("/")
    def read_root():
        return {"message": "Welcome to the OTP Attendance System API (Frontend build not found)"}

