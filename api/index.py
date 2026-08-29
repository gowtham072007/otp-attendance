import sys
import os

# Ensure backend and root are in sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(root_dir, "backend")

for directory in [root_dir, backend_dir]:
    if directory not in sys.path:
        sys.path.insert(0, directory)

try:
    from app.main import app
except Exception:
    from backend.app.main import app

# Export standard WSGI/ASGI application variables for Vercel
application = app
handler = app

__all__ = ["app", "application", "handler"]
