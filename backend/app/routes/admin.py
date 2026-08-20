import random
import string
import csv
import io
from typing import List
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, AttendanceSession, OTP, AttendanceRecord, AllowedEmail
from ..schemas import (
    OTPSessionResponse, 
    OTPResponse, 
    AllowedEmailCreate, 
    AllowedEmailBulkCreate, 
    AllowedEmailResponse
)
from ..auth.utils import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])

# --- Session & OTP Endpoints ---

@router.post("/session/start", response_model=OTPSessionResponse)
def start_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    # Check if there's already an active session
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if active_session:
        raise HTTPException(status_code=400, detail="An active session already exists")
    
    new_session = AttendanceSession(admin_id=admin.id, status="ACTIVE")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.post("/session/generate-otp", response_model=OTPResponse)
def generate_otp(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session found. Start a session first.")
    
    # Invalidate previous OTPs for this session
    previous_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
    for otp in previous_otps:
        otp.status = "INVALIDATED"
    
    # Generate 6-digit random OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=7) # 7 seconds expiry
    
    new_otp = OTP(session_id=active_session.id, otp_code=otp_code, expires_at=expires_at, status="ACTIVE")
    db.add(new_otp)
    db.commit()
    db.refresh(new_otp)
    return new_otp

@router.post("/session/end")
def end_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session to end")
    
    active_session.status = "CLOSED"
    
    # Invalidate any active OTPs
    active_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
    for otp in active_otps:
        otp.status = "INVALIDATED"
        
    db.commit()
    return {"message": "Session ended successfully"}

@router.get("/session/current")
def get_current_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        return {"session": None, "otp": None}
    
    active_otp = db.query(OTP).filter(
        OTP.session_id == active_session.id, 
        OTP.status == "ACTIVE",
        OTP.expires_at > datetime.now(timezone.utc)
    ).order_by(OTP.created_at.desc()).first()
    
    return {
        "session": active_session.id,
        "otp": {
            "code": active_otp.otp_code if active_otp else None,
            "expires_at": active_otp.expires_at if active_otp else None,
            "status": active_otp.status if active_otp else None
        } if active_otp else None
    }

@router.get("/session/attendance")
def get_attendance(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    records = db.query(AttendanceRecord).join(User).all()
    result = []
    for r in records:
        result.append({
            "name": r.user.full_name,
            "email": r.user.email,
            "date": r.timestamp.strftime("%Y-%m-%d"),
            "time": r.timestamp.strftime("%H:%M:%S"),
            "session": f"Session {r.session_id:02d}",
            "status": r.status
        })
    return result

@router.get("/session/attendance/export")
def export_attendance(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    records = db.query(AttendanceRecord).join(User).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Date", "Time", "Session", "Status"])
    
    for r in records:
        writer.writerow([
            r.user.full_name,
            r.user.email,
            r.timestamp.strftime("%Y-%m-%d"),
            r.timestamp.strftime("%H:%M:%S"),
            f"Session {r.session_id:02d}",
            r.status
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": "attachment; filename=attendance.csv"}
    )

# --- Allowed Email Whitelist Management ---

@router.get("/allowed-emails", response_model=List[AllowedEmailResponse])
def get_allowed_emails(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return db.query(AllowedEmail).order_by(AllowedEmail.created_at.desc()).all()

@router.post("/allowed-emails", response_model=AllowedEmailResponse)
def add_allowed_email(payload: AllowedEmailCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required")
    
    if "@" not in email_clean or "." not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address format")
    
    # Check if already exists
    existing = db.query(AllowedEmail).filter(AllowedEmail.email == email_clean).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Email '{email_clean}' is already registered in the allowed list")
    
    new_allowed = AllowedEmail(
        email=email_clean,
        name=payload.name.strip() if payload.name else None
    )
    db.add(new_allowed)
    db.commit()
    db.refresh(new_allowed)
    return new_allowed

@router.post("/allowed-emails/bulk")
def add_bulk_allowed_emails(payload: AllowedEmailBulkCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    added_count = 0
    skipped_count = 0
    errors = []
    
    for raw_email in payload.emails:
        clean = raw_email.strip().lower()
        if not clean:
            continue
        if "@" not in clean or "." not in clean:
            skipped_count += 1
            errors.append(f"Invalid email: {raw_email}")
            continue
        
        existing = db.query(AllowedEmail).filter(AllowedEmail.email == clean).first()
        if existing:
            skipped_count += 1
            continue
            
        new_entry = AllowedEmail(email=clean, name=None)
        db.add(new_entry)
        added_count += 1
        
    db.commit()
    return {
        "message": f"Successfully added {added_count} emails. {skipped_count} skipped.",
        "added_count": added_count,
        "skipped_count": skipped_count,
        "errors": errors
    }

@router.delete("/allowed-emails/{email_id}")
def delete_allowed_email(email_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    record = db.query(AllowedEmail).filter(AllowedEmail.id == email_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Allowed email record not found")
    
    db.delete(record)
    db.commit()
    return {"message": "Allowed email removed successfully"}

