import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from ..database import get_db
from ..models import User, AllowedEmail, UserDevice
from ..schemas import DirectLoginRequest, Token, UserResponse
from ..auth.utils import create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["auth"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@example.com").strip().lower()

@router.post("/login", response_model=Token)
def direct_login(request: DirectLoginRequest, db: Session = Depends(get_db)):
    try:
        email = request.email.strip().lower()
        full_name = request.full_name.strip()
        device_id = (request.device_id or "").strip()
        device_name = (request.device_name or "Web Browser").strip()
        
        if not email or not full_name:
            raise HTTPException(status_code=400, detail="Name and Email are required")

        # Determine if this user is or should be an Admin
        is_initial_admin = (email == INITIAL_ADMIN_EMAIL)
        user = db.query(User).filter(func.lower(User.email) == email).first()
        is_admin = is_initial_admin or (user is not None and user.role == "ADMIN")

        if not is_admin:
            # Check if email is in allowed_emails whitelist
            allowed = db.query(AllowedEmail).filter(func.lower(AllowedEmail.email) == email).first()
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access Denied: Your email ID is not authorized. Please contact the Admin to register your email."
                )
        else:
            # Admin login: permanently ensure admin email is in the Authorized Login Whitelist
            allowed = db.query(AllowedEmail).filter(func.lower(AllowedEmail.email) == email).first()
            if not allowed:
                admin_allowed = AllowedEmail(
                    email=email,
                    name=full_name or "Administrator"
                )
                db.add(admin_allowed)
                db.commit()

        if not user:
            # Create user
            role = "ADMIN" if is_admin else "USER"
            user = User(
                email=email,
                google_id=str(uuid.uuid4()), # Unique id
                full_name=full_name,
                picture="",
                role=role
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            if full_name and user.full_name != full_name:
                user.full_name = full_name
                db.commit()
                db.refresh(user)

        # Strict 1 User per Device Policy Enforcement (For regular students)
        if user.role == "USER":
            if not device_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device Identification required. Please ensure localStorage / cookies are enabled in your browser."
                )

            # Check 1: Is this physical device already registered to ANOTHER user?
            device_conflict = db.query(UserDevice).filter(
                UserDevice.device_id == device_id,
                UserDevice.user_id != user.id,
                UserDevice.is_linked == True
            ).first()

            if device_conflict:
                conflict_user = device_conflict.user
                conflict_email = conflict_user.email if conflict_user else "another account"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Device Conflict: This device is already linked to another student ({conflict_email}). Policy allows only 1 student account per device. Please use your own device or contact the Admin."
                )

            # Check 2: Is this user already registered on a DIFFERENT device?
            user_device = db.query(UserDevice).filter(
                UserDevice.user_id == user.id,
                UserDevice.is_linked == True
            ).first()

            if user_device and user_device.device_id != device_id:
                bound_device_name = user_device.device_name or "your registered device"
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Device Lock Active: Your account is already bound to {bound_device_name}. You can only log in from your registered device. Please contact the Admin to reset your device link."
                )

            # Link or update device
            now_utc = datetime.now(timezone.utc)
            if not user_device:
                existing_record = db.query(UserDevice).filter(UserDevice.user_id == user.id).first()
                if existing_record:
                    existing_record.device_id = device_id
                    existing_record.device_name = device_name
                    existing_record.is_linked = True
                    existing_record.last_login_at = now_utc
                else:
                    new_dev = UserDevice(
                        user_id=user.id,
                        device_id=device_id,
                        device_name=device_name,
                        is_linked=True,
                        first_linked_at=now_utc,
                        last_login_at=now_utc
                    )
                    db.add(new_dev)
            else:
                user_device.last_login_at = now_utc
                if device_name:
                    user_device.device_name = device_name
            
            db.commit()
            db.refresh(user)

        # Generate JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
        )
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": user
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
