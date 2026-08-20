from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..models import User, AttendanceSession, OTP, AttendanceRecord
from ..schemas import AttendanceSubmission
from ..auth.utils import get_current_user

router = APIRouter(prefix="/attendance", tags=["attendance"])

# --- Indian Standard Time (IST) Helpers ---
IST = timezone(timedelta(hours=5, minutes=30), name="IST")

def to_ist(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc).astimezone(IST)
    return dt.astimezone(IST)

def format_ist_date(dt: Optional[datetime]) -> str:
    ist_dt = to_ist(dt)
    return ist_dt.strftime("%d-%m-%Y") if ist_dt else "—"

def format_ist_time(dt: Optional[datetime]) -> str:
    ist_dt = to_ist(dt)
    return ist_dt.strftime("%I:%M %p") if ist_dt else "—"

def get_today_session(db: Session) -> Optional[AttendanceSession]:
    now_ist = datetime.now(IST)
    start_of_day_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 0, 0, 0, tzinfo=IST)
    end_of_day_ist = datetime(now_ist.year, now_ist.month, now_ist.day, 23, 59, 59, tzinfo=IST)
    start_utc = start_of_day_ist.astimezone(timezone.utc).replace(tzinfo=None)
    end_utc = end_of_day_ist.astimezone(timezone.utc).replace(tzinfo=None)
    return db.query(AttendanceSession).filter(
        AttendanceSession.created_at >= start_utc,
        AttendanceSession.created_at <= end_utc
    ).order_by(AttendanceSession.created_at.desc()).first()

@router.get("/session/status")
def get_session_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    today_session = get_today_session(db)
    
    # Check if student marked attendance for active or today's session
    my_record = None
    target_session = active_session or today_session
    if target_session:
        my_record = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id == target_session.id,
            AttendanceRecord.user_id == current_user.id
        ).first()
        
    return {
        "active_session": {
            "id": active_session.id,
            "status": active_session.status
        } if active_session else None,
        "today_session": {
            "id": today_session.id,
            "status": today_session.status,
            "date": format_ist_date(today_session.created_at),
            "time": format_ist_time(today_session.created_at)
        } if today_session else None,
        "already_marked": my_record is not None,
        "my_record": {
            "time": format_ist_time(my_record.timestamp),
            "date": format_ist_date(my_record.timestamp),
            "status": my_record.status,
            "session": f"Session {target_session.id:02d}"
        } if my_record else None
    }


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
        db.refresh(new_attendance)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Attendance Already Marked. You cannot mark attendance again for this session.")
        
    return {
        "message": "Attendance Marked Successfully!",
        "name": current_user.full_name,
        "email": current_user.email,
        "date": format_ist_date(new_attendance.timestamp),
        "time": format_ist_time(new_attendance.timestamp),
        "status": new_attendance.status
    }

@router.get("/my-history")
def get_my_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.id).order_by(AttendanceRecord.timestamp.desc()).all()
    
    result = []
    for r in records:
        result.append({
            "date": format_ist_date(r.timestamp),
            "session": f"Session {r.session_id:02d}",
            "time": format_ist_time(r.timestamp),
            "status": r.status
        })
    return result

