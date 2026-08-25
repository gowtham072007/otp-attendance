import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..models import User, UserDevice, DeviceAuditLog, AllowedEmail
from ..schemas import (
    Token, 
    UserResponse, 
    LoginRequest, 
    DirectLoginRequest, 
    GoogleLoginRequest, 
    RegisterRequest,
    UserDeviceResponse
)
from ..auth.utils import (
    create_access_token, 
    get_current_user, 
    hash_password, 
    verify_password,
    check_rate_limit,
    record_failed_attempt,
    clear_failed_attempts,
    ACCESS_TOKEN_EXPIRE_MINUTES
)

router = APIRouter(prefix="/auth", tags=["auth"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@example.com").strip().lower()

def get_client_ip(request: Request) -> str:
    """Extract client IP address from request headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"

# --- Helper to handle device binding & validation ---

def process_device_binding(
    db: Session, 
    user: User, 
    device_id: str, 
    device_name: str | None, 
    ip_address: str, 
    user_agent: str | None
) -> UserDevice:
    """
    Enforces the strict 1 user -> 1 device rule.
    - If user has no active device linked: registers the new device and creates audit log.
    - If user has an active device linked:
        - If device_id matches: allows login and updates timestamps.
        - If device_id does NOT match: logs blocked attempt and raises 403.
    """
    clean_device_id = (device_id or "").strip()
    if not clean_device_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Device identification failed. Device ID is required for authentication."
        )

    # Fetch existing device record for this user
    user_device = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()

    now = datetime.now(timezone.utc)

    # Case 1: No device linked yet (first login) OR previous device was unlinked/reset by Admin
    if not user_device or not user_device.is_linked:
        if not user_device:
            user_device = UserDevice(
                user_id=user.id,
                device_id=clean_device_id,
                device_name=device_name or "Web Browser Device",
                user_agent=user_agent,
                ip_address=ip_address,
                is_linked=True,
                first_linked_at=now,
                last_login_at=now,
                last_active_at=now
            )
            db.add(user_device)
        else:
            user_device.device_id = clean_device_id
            user_device.device_name = device_name or user_device.device_name or "Web Browser Device"
            user_device.user_agent = user_agent
            user_device.ip_address = ip_address
            user_device.is_linked = True
            user_device.first_linked_at = now
            user_device.last_login_at = now
            user_device.last_active_at = now

        # Create audit log for device registration
        audit_log = DeviceAuditLog(
            user_id=user.id,
            admin_id=None,
            action="DEVICE_REGISTERED",
            device_id=clean_device_id,
            device_name=device_name or "Web Browser Device",
            details=f"Account linked to new device '{device_name or clean_device_id}' upon login.",
            ip_address=ip_address,
            timestamp=now
        )
        db.add(audit_log)
        db.commit()
        db.refresh(user_device)
        return user_device

    # Case 2: Device already linked -> Check for device match
    if user_device.device_id != clean_device_id:
        # MISMATCH: Block login attempt
        blocked_log = DeviceAuditLog(
            user_id=user.id,
            admin_id=None,
            action="LOGIN_BLOCKED_MISMATCH",
            device_id=clean_device_id,
            device_name=device_name or "Unknown Device",
            details=(
                f"Blocked login attempt from unauthorized device '{device_name}' (ID: {clean_device_id}). "
                f"Account is registered to '{user_device.device_name}' (ID: {user_device.device_id})."
            ),
            ip_address=ip_address,
            timestamp=now
        )
        db.add(blocked_log)
        db.commit()

        # Strict exact error message required by specifications
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is already linked to another device. Please use your registered device or contact the administrator."
        )

    # Case 3: Device matches -> Update activity timestamps
    user_device.last_login_at = now
    user_device.last_active_at = now
    if device_name:
        user_device.device_name = device_name
    if user_agent:
        user_agent = user_agent
    user_device.ip_address = ip_address

    # Record login audit log
    login_log = DeviceAuditLog(
        user_id=user.id,
        admin_id=None,
        action="LOGIN_SUCCESS",
        device_id=clean_device_id,
        device_name=device_name or user_device.device_name,
        details="Successful login from registered device.",
        ip_address=ip_address,
        timestamp=now
    )
    db.add(login_log)
    db.commit()
    db.refresh(user_device)
    return user_device


# --- Authentication Endpoints ---

@router.post("/login", response_model=Token)
def login(request_data: LoginRequest, http_req: Request, db: Session = Depends(get_db)):
    """
    Universal login endpoint:
    - Supports Username/Email + Password OR Direct Whitelisted Email access.
    - Strictly enforces one-device per user policy.
    - Returns JWT token containing device_id claim.
    """
    client_ip = get_client_ip(http_req)
    rate_limit_key = f"{client_ip}:{request_data.identifier.strip().lower()}"
    check_rate_limit(rate_limit_key)

    identifier = request_data.identifier.strip().lower()
    password = request_data.password
    full_name = (request_data.full_name or "").strip()
    device_id = (request_data.device_id or "").strip()
    device_name = request_data.device_name or "Web Browser Device"
    user_agent = http_req.headers.get("User-Agent", "")

    if not identifier:
        record_failed_attempt(rate_limit_key)
        raise HTTPException(status_code=400, detail="Username or Email is required.")

    if not device_id:
        record_failed_attempt(rate_limit_key)
        raise HTTPException(status_code=400, detail="Device ID is required to authenticate.")

    # Find user by email or username
    user = db.query(User).filter(
        (func.lower(User.email) == identifier) | (func.lower(User.username) == identifier)
    ).first()

    is_initial_admin = (identifier == INITIAL_ADMIN_EMAIL)
    is_admin = is_initial_admin or (user is not None and user.role == "ADMIN")

    if not is_admin:
        # Whitelist check for regular users
        allowed = db.query(AllowedEmail).filter(
            (func.lower(AllowedEmail.email) == identifier) | 
            (func.lower(AllowedEmail.email) == (user.email.lower() if user else ""))
        ).first()

        if not allowed and not user:
            record_failed_attempt(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Your account/email is not authorized. Please contact the Admin to register."
            )
    else:
        # Ensure initial admin is in allowed_emails whitelist
        allowed = db.query(AllowedEmail).filter(func.lower(AllowedEmail.email) == identifier).first()
        if not allowed and "@" in identifier:
            admin_allowed = AllowedEmail(email=identifier, name=full_name or "Administrator")
            db.add(admin_allowed)
            db.commit()

    # User existence handling
    if not user:
        # Create new user record
        role = "ADMIN" if is_admin else "USER"
        user_email = identifier if "@" in identifier else f"{identifier}@attendance.internal"
        user_username = identifier.split("@")[0] if "@" in identifier else identifier
        
        user = User(
            email=user_email,
            username=user_username,
            google_id=str(uuid.uuid4()),
            full_name=full_name or user_username.title(),
            password_hash=hash_password(password) if password else None,
            picture="",
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Check if user account is active
        if not user.is_active:
            record_failed_attempt(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled. Please contact the administrator."
            )

        # If user has a password set, verify password
        if user.password_hash and password:
            if not verify_password(password, user.password_hash):
                record_failed_attempt(rate_limit_key)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials. Please check your username/email and password."
                )
        elif not user.password_hash and password:
            # Set password on first password login
            user.password_hash = hash_password(password)
            db.commit()

        # Update full name if supplied and different
        if full_name and user.full_name != full_name:
            user.full_name = full_name
            db.commit()
            db.refresh(user)

    # Process Device Binding & Strict 1-Device Check
    if user.role == "USER":
        try:
            user_device = process_device_binding(
                db=db,
                user=user,
                device_id=device_id,
                device_name=device_name,
                ip_address=client_ip,
                user_agent=user_agent
            )
        except HTTPException:
            record_failed_attempt(rate_limit_key)
            raise
    else:
        # Admin account handling
        now = datetime.now(timezone.utc)
        user_device = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()
        if not user_device:
            user_device = UserDevice(
                user_id=user.id,
                device_id=device_id,
                device_name=device_name or "Admin Station",
                ip_address=client_ip,
                user_agent=user_agent,
                is_linked=True,
                first_linked_at=now,
                last_login_at=now,
                last_active_at=now
            )
            db.add(user_device)
        else:
            user_device.device_id = device_id
            user_device.device_name = device_name or user_device.device_name
            user_device.last_login_at = now
            user_device.last_active_at = now
            user_device.is_linked = True
        db.commit()

    # Login succeeded -> Clear rate limit failures
    clear_failed_attempts(rate_limit_key)

    # Issue JWT token with device_id embedded
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "device_id": device_id
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "device_id": device_id
    }


@router.post("/google", response_model=Token)
def google_login(request_data: GoogleLoginRequest, http_req: Request, db: Session = Depends(get_db)):
    """
    Google Sign-In / OAuth authentication endpoint:
    - Enforces 1 user -> 1 device policy.
    - Validates email authorization.
    """
    client_ip = get_client_ip(http_req)
    email = request_data.email.strip().lower()
    device_id = (request_data.device_id or "").strip()
    device_name = request_data.device_name or "Web Browser Device"
    user_agent = http_req.headers.get("User-Agent", "")

    if not email:
        raise HTTPException(status_code=400, detail="Gmail ID / Email is required.")
    if not device_id:
        raise HTTPException(status_code=400, detail="Device ID is required to authenticate.")

    is_initial_admin = (email == INITIAL_ADMIN_EMAIL)
    user = db.query(User).filter(func.lower(User.email) == email).first()
    is_admin = is_initial_admin or (user is not None and user.role == "ADMIN")

    if not is_admin:
        allowed = db.query(AllowedEmail).filter(func.lower(AllowedEmail.email) == email).first()
        if not allowed and not user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Your Gmail address is not registered. Please contact the administrator."
            )

    if not user:
        role = "ADMIN" if is_admin else "USER"
        user = User(
            email=email,
            username=email.split("@")[0],
            google_id=request_data.google_id or str(uuid.uuid4()),
            full_name=request_data.full_name or email.split("@")[0].title(),
            picture=request_data.picture or "",
            role=role,
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account disabled. Please contact the administrator."
            )
        if request_data.full_name and user.full_name != request_data.full_name:
            user.full_name = request_data.full_name
            db.commit()

    # Enforce device binding for students/users
    if user.role == "USER":
        user_device = process_device_binding(
            db=db,
            user=user,
            device_id=device_id,
            device_name=device_name,
            ip_address=client_ip,
            user_agent=user_agent
        )
    else:
        user_device = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()
        now = datetime.now(timezone.utc)
        if not user_device:
            user_device = UserDevice(
                user_id=user.id,
                device_id=device_id,
                device_name=device_name or "Admin Station",
                ip_address=client_ip,
                user_agent=user_agent,
                is_linked=True,
                first_linked_at=now,
                last_login_at=now,
                last_active_at=now
            )
            db.add(user_device)
        else:
            user_device.device_id = device_id
            user_device.last_login_at = now
            user_device.last_active_at = now
            user_device.is_linked = True
        db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "device_id": device_id
        },
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "device_id": device_id
    }


@router.post("/register", response_model=Token)
def register(request_data: RegisterRequest, http_req: Request, db: Session = Depends(get_db)):
    """
    User registration with username, email, password, and instant device binding.
    """
    client_ip = get_client_ip(http_req)
    email = request_data.email.strip().lower()
    username = (request_data.username or email.split("@")[0]).strip().lower()
    full_name = request_data.full_name.strip()
    device_id = (request_data.device_id or "").strip()
    device_name = request_data.device_name or "Web Browser Device"

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not request_data.password or len(request_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if not device_id:
        raise HTTPException(status_code=400, detail="Device ID is required.")

    # Check for existing email or username
    existing_user = db.query(User).filter(
        (func.lower(User.email) == email) | (func.lower(User.username) == username)
    ).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email or username already exists.")

    # Whitelist verification
    allowed = db.query(AllowedEmail).filter(func.lower(AllowedEmail.email) == email).first()
    is_initial_admin = (email == INITIAL_ADMIN_EMAIL)
    if not allowed and not is_initial_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Your email is not in the authorized student list. Contact the admin."
        )

    role = "ADMIN" if is_initial_admin else "USER"
    new_user = User(
        email=email,
        username=username,
        full_name=full_name,
        password_hash=hash_password(request_data.password),
        google_id=str(uuid.uuid4()),
        role=role,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Bind to current device
    process_device_binding(
        db=db,
        user=new_user,
        device_id=device_id,
        device_name=device_name,
        ip_address=client_ip,
        user_agent=http_req.headers.get("User-Agent", "")
    )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email, "role": new_user.role, "device_id": device_id},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user,
        "device_id": device_id
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return profile of currently authenticated user with device info."""
    return current_user


@router.get("/device-status")
def get_device_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return device registration status for currently logged in user."""
    device = db.query(UserDevice).filter(UserDevice.user_id == current_user.id).first()
    return {
        "user_id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_linked": device.is_linked if device else False,
        "device_id": device.device_id if device else None,
        "device_name": device.device_name if device else None,
        "first_linked_at": device.first_linked_at if device else None,
        "last_login_at": device.last_login_at if device else None,
        "last_active_at": device.last_active_at if device else None
    }


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Log out current user session."""
    device = db.query(UserDevice).filter(UserDevice.user_id == current_user.id).first()
    if device:
        device.last_active_at = datetime.now(timezone.utc)
        db.commit()
    return {"message": "Logged out successfully."}

