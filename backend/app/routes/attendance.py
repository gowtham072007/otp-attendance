from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..models import User, AttendanceSession, OTP, AttendanceRecord
from ..schemas import AttendanceSubmission
from ..auth.utils import get_current_user

router = APIRouter(prefix="/attendance", tags=["attendance"])

@router.post("/mark")
def mark_attendance(submission: AttendanceSubmission, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Find active session
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active attendance session.")
    
    # Find matching OTP for the session
    otp_record = db.query(OTP).filter(
        OTP.session_id == active_session.id,
        OTP.otp_code == submission.otp_code,
        OTP.status == "ACTIVE"
    ).first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please enter the current OTP displayed by the Admin.")
    
    # Check expiry
    if otp_record.expires_at.tzinfo is None:
        # If naive, compare with naive UTC
        if otp_record.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="OTP Expired. Please ask the Admin for the new OTP.")
    else:
        # If aware, compare with aware UTC
        if otp_record.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="OTP Expired. Please ask the Admin for the new OTP.")
            
    # Record attendance
    try:
        new_attendance = AttendanceRecord(
            session_id=active_session.id,
            user_id=current_user.id,
            status="Present"
        )
        db.add(new_attendance)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Attendance Already Marked. You cannot mark attendance again for this session.")
        
    return {
        "message": "Attendance Marked Successfully!",
        "name": current_user.full_name,
        "email": current_user.email,
        "date": new_attendance.timestamp.strftime("%d-%m-%Y"),
        "time": new_attendance.timestamp.strftime("%I:%M %p"),
        "status": new_attendance.status
    }

@router.get("/my-history")
def get_my_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id).order_by(AttendanceRecord.timestamp.desc()).all()
    
    result = []
    for r in records:
        result.append({
            "date": r.timestamp.strftime("%d-%m-%Y"),
            "session": f"Session {r.session_id:02d}",
            "time": r.timestamp.strftime("%I:%M %p"),
            "status": r.status
        })
    return result
