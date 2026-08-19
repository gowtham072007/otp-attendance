import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from ..database import get_db
from ..models import User
from ..schemas import DirectLoginRequest, Token, UserResponse
from ..auth.utils import create_access_token, get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
import uuid

router = APIRouter(prefix="/auth", tags=["auth"])
INITIAL_ADMIN_EMAIL = os.getenv("INITIAL_ADMIN_EMAIL", "admin@example.com")

@router.post("/login", response_model=Token)
def direct_login(request: DirectLoginRequest, db: Session = Depends(get_db)):
    try:
        email = request.email.strip().lower()
        full_name = request.full_name.strip()
        
        if not email or not full_name:
            raise HTTPException(status_code=400, detail="Name and Email are required")

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Create user
            role = "ADMIN" if email == INITIAL_ADMIN_EMAIL else "USER"
            user = User(
                email=email,
                google_id=str(uuid.uuid4()), # Just a unique id since we aren't using Google
                full_name=full_name,
                picture="",
                role=role
            )
            db.add(user)
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
