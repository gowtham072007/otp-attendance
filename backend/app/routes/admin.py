import random
import string
import csv
import io
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
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

# --- Helper to calculate Present and Absent students for a session ---

def compute_session_attendance(db: Session, session_id: Optional[int] = None):
    if session_id:
        target_session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    else:
        # Get active session or most recent session
        target_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
        if not target_session:
            target_session = db.query(AttendanceSession).order_by(AttendanceSession.id.desc()).first()
            
    if not target_session:
        return {
            "session": None,
            "summary": {"total": 0, "present": 0, "absent": 0, "rate": "0%"},
            "records": []
        }
        
    # Get attendance records for this session
    attendance_records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == target_session.id).all()
    present_user_ids = {r.user_id: r for r in attendance_records}
    
    # Get all whitelisted emails
    allowed_list = db.query(AllowedEmail).all()
    # Also get all regular users
    regular_users = db.query(User).filter(User.role == "USER").all()
    user_by_email = {u.email.lower().strip(): u for u in regular_users}
    
    # Build student roster
    roster = {}
    for allowed in allowed_list:
        clean_email = allowed.email.lower().strip()
        user_obj = user_by_email.get(clean_email)
        name = user_obj.full_name if (user_obj and user_obj.full_name) else (allowed.name or "Registered Student")
        user_id = user_obj.id if user_obj else None
        roster[clean_email] = {
            "email": allowed.email,
            "name": name,
            "user_id": user_id
        }
        
    # If no whitelist entries exist, fallback to all registered USERs
    if not allowed_list:
        for u in regular_users:
            clean_email = u.email.lower().strip()
            roster[clean_email] = {
                "email": u.email,
                "name": u.full_name,
                "user_id": u.id
            }
            
    # Also include any student who attended but might not be in whitelist
    for r in attendance_records:
        if r.user:
            clean_email = r.user.email.lower().strip()
            if clean_email not in roster:
                roster[clean_email] = {
                    "email": r.user.email,
                    "name": r.user.full_name,
                    "user_id": r.user.id
                }

    records = []
    present_count = 0
    absent_count = 0
    
    for email_key, student in roster.items():
        user_id = student["user_id"]
        att_record = None
        if user_id and user_id in present_user_ids:
            att_record = present_user_ids[user_id]
        
        if att_record:
            present_count += 1
            records.append({
                "name": student["name"],
                "email": student["email"],
                "date": att_record.timestamp.strftime("%Y-%m-%d"),
                "time": att_record.timestamp.strftime("%H:%M:%S"),
                "session": f"Session {target_session.id:02d}",
                "status": "Present"
            })
        else:
            absent_count += 1
            records.append({
                "name": student["name"],
                "email": student["email"],
                "date": target_session.created_at.strftime("%Y-%m-%d"),
                "time": "—",
                "session": f"Session {target_session.id:02d}",
                "status": "Absent"
            })
            
    total = len(roster)
    rate = f"{round((present_count / total) * 100)}%" if total > 0 else "0%"
    
    # Sort: Present first, then alphabetical by name
    records.sort(key=lambda x: (0 if x["status"] == "Present" else 1, x["name"].lower()))
    
    return {
        "session": {
            "id": target_session.id,
            "status": target_session.status,
            "created_at": target_session.created_at
        },
        "summary": {
            "total": total,
            "present": present_count,
            "absent": absent_count,
            "rate": rate
        },
        "records": records
    }

# --- Session & OTP Endpoints ---

@router.get("/sessions")
def get_all_sessions(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    sessions = db.query(AttendanceSession).order_by(AttendanceSession.id.desc()).all()
    result = []
    for s in sessions:
        count = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).count()
        result.append({
            "id": s.id,
            "status": s.status,
            "created_at": s.created_at,
            "present_count": count
        })
    return result

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
    
    # Compute report for the ended session
    report = compute_session_attendance(db, active_session.id)
    
    return {
        "message": "Session ended successfully",
        "session_id": active_session.id,
        "report": report
    }

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
def get_attendance(session_id: Optional[int] = None, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return compute_session_attendance(db, session_id)

@router.get("/session/attendance/export")
def export_attendance(session_id: Optional[int] = None, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    data = compute_session_attendance(db, session_id)
    records = data["records"]
    session_info = data["session"]
    session_num = f"Session_{session_info['id']:02d}" if session_info else "Attendance"
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student Name", "Email", "Date", "Time", "Session", "Status"])
    
    for r in records:
        writer.writerow([
            r["name"],
            r["email"],
            r["date"],
            r["time"],
            r["session"],
            r["status"]
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=attendance_{session_num}_{datetime.now().strftime('%Y-%m-%d')}.csv"}
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

