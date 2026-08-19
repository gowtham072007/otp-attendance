import random
import string
import csv
import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User, AttendanceSession, OTP, AttendanceRecord
from ..schemas import OTPSessionResponse, OTPResponse
from ..auth.utils import get_current_admin

router = APIRouter(prefix="/admin/session", tags=["admin"])

@router.post("/start", response_model=OTPSessionResponse)
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

@router.post("/generate-otp", response_model=OTPResponse)
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

@router.post("/end")
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

@router.get("/current")
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

@router.get("/attendance")
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

@router.get("/attendance/export")
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
