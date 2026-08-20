import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from ..database import get_db
from ..models import User, AllowedEmail
from ..schemas import DirectLoginRequest, Token, UserResponse
from ..auth.utils import create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@example.com").strip().lower()

@router.post("/login", response_model=Token)
def direct_login(request: DirectLoginRequest, db: Session = Depends(get_db)):
    try:
        email = request.email.strip().lower()
        full_name = request.full_name.strip()
        
        if not email or not full_name:
            raise HTTPException(status_code=400, detail="Name and Email are required")

        # Determine if this user is or should be an Admin
        is_initial_admin = (email == INITIAL_ADMIN_EMAIL)
        user = db.query(User).filter(User.email == email).first()
        is_admin = is_initial_admin or (user is not None and user.role == "ADMIN")

        if not is_admin:
            # Check if email is in allowed_emails whitelist
            allowed = db.query(AllowedEmail).filter(AllowedEmail.email == email).first()
            if not allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access Denied: Your email ID is not authorized. Please contact the Admin to register your email."
                )

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

        # Generate JWT token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role}, expires_delta=access_token_expires
        )
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
