import os
import bcrypt
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import User, UserDevice

SECRET_KEY = os.getenv("SECRET_KEY", "generate_a_secure_random_string_here_and_keep_it_secret_attendance_key_2026")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# --- Password Security ---

def hash_password(password: str) -> str:
    """Securely hash password using bcrypt."""
    if not password:
        return ""
    # Truncate to 72 bytes to satisfy bcrypt standard
    pwd_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pwd_bytes, bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(pwd_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False

# --- Rate Limiter (In-Memory Sliding Window) ---

# Stores list of timestamps for failed attempts per key (IP or identifier)
_login_attempts = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 300 # 5 minutes
MAX_FAILED_ATTEMPTS = 5

def check_rate_limit(key: str) -> None:
    """Check if the key has exceeded max login attempts within window."""
    now = time.time()
    # Clean up timestamps older than window
    _login_attempts[key] = [t for t in _login_attempts[key] if now - t < RATE_LIMIT_WINDOW_SECONDS]
    
    if len(_login_attempts[key]) >= MAX_FAILED_ATTEMPTS:
        remaining = int(RATE_LIMIT_WINDOW_SECONDS - (now - _login_attempts[key][0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please wait {max(remaining, 1)} seconds before trying again."
        )

def record_failed_attempt(key: str) -> None:
    """Record a failed login attempt."""
    _login_attempts[key].append(time.time())

def clear_failed_attempts(key: str) -> None:
    """Clear failed attempts on successful login."""
    if key in _login_attempts:
        del _login_attempts[key]

# --- JWT Token Generation & Verification ---

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create JWT access token embedded with user details and device_id."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Validate JWT token, verify user exists and is active, and ensure the token's
    embedded device_id matches the user's currently registered device.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session has expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        token_device_id: str = payload.get("device_id")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()
    if user is None:
        raise credentials_exception

    # Check if account is active/enabled
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account disabled. Please contact the administrator."
        )

    # Validate device binding if user is a standard student/user
    if user.role == "USER" and token_device_id:
        user_device = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()
        if user_device and user_device.is_linked:
            if user_device.device_id != token_device_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="This session was invalidated because your device binding was reset or changed. Please log in again from your registered device."
                )
            # Update last active timestamp
            try:
                user_device.last_active_at = datetime.now(timezone.utc)
                db.commit()
            except Exception:
                db.rollback()

    return user

def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    """Ensure current authenticated user has ADMIN role."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required."
        )
    return current_user

