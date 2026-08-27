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
import os
try:
    from ..database import get_db
    from ..models import User, AttendanceSession, OTP, AttendanceRecord, AllowedEmail, UserDevice, GeofenceConfig
    from ..schemas import (
        OTPSessionResponse, 
        OTPResponse, 
        AllowedEmailCreate, 
        AllowedEmailBulkCreate, 
        AllowedEmailResponse,
        GeofenceConfigResponse,
        GeofenceConfigUpdate,
        ManualAttendanceRequest
    )
    from ..auth.utils import get_current_admin
except (ImportError, ValueError):
    from app.database import get_db
    from app.models import User, AttendanceSession, OTP, AttendanceRecord, AllowedEmail, UserDevice, GeofenceConfig
    from app.schemas import (
        OTPSessionResponse, 
        OTPResponse, 
        AllowedEmailCreate, 
        AllowedEmailBulkCreate, 
        AllowedEmailResponse,
        GeofenceConfigResponse,
        GeofenceConfigUpdate,
        ManualAttendanceRequest
    )
    from app.auth.utils import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])

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
    return ist_dt.strftime("%I:%M:%S %p") if ist_dt else "—"

def format_ist_time_short(dt: Optional[datetime]) -> str:
    ist_dt = to_ist(dt)
    return ist_dt.strftime("%I:%M %p") if ist_dt else "—"

def get_active_geofence(db: Session) -> GeofenceConfig:
    config = db.query(GeofenceConfig).first()
    if not config:
        config = GeofenceConfig(
            venue_name="Francis Xavier Engineering College",
            latitude=float(os.getenv("TARGET_LATITUDE", "8.732309")),
            longitude=float(os.getenv("TARGET_LONGITUDE", "77.723764")),
            radius_meters=float(os.getenv("GEOFENCE_RADIUS_METERS", "500.0"))
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config

def get_today_session(db: Session, admin_id: Optional[int] = None) -> Optional[AttendanceSession]:
    today_ist_str = datetime.now(IST).strftime("%d-%m-%Y")
    query = db.query(AttendanceSession)
    if admin_id is not None:
        query = query.filter(AttendanceSession.admin_id == admin_id)
    sessions = query.order_by(AttendanceSession.id.desc()).all()
    for s in sessions:
        if format_ist_date(s.created_at) == today_ist_str:
            return s
    return None

# --- Helper to calculate Present and Absent students for a session ---

def compute_session_attendance(db: Session, session_id: Optional[int] = None, admin_id: Optional[int] = None):
    geofence = get_active_geofence(db)
    if session_id:
        query = db.query(AttendanceSession).filter(AttendanceSession.id == session_id)
        if admin_id is not None:
            query = query.filter(AttendanceSession.admin_id == admin_id)
        target_session = query.first()
    else:
        # Check today's session first, or active session, or most recent session for this admin
        target_session = get_today_session(db, admin_id=admin_id)
        if not target_session:
            query = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE")
            if admin_id is not None:
                query = query.filter(AttendanceSession.admin_id == admin_id)
            target_session = query.first()
        if not target_session:
            query = db.query(AttendanceSession)
            if admin_id is not None:
                query = query.filter(AttendanceSession.admin_id == admin_id)
            target_session = query.order_by(AttendanceSession.id.desc()).first()
            
    if not target_session:
        return {
            "session": None,
            "geofence": {
                "venue_name": geofence.venue_name,
                "latitude": geofence.latitude,
                "longitude": geofence.longitude,
                "radius_meters": geofence.radius_meters
            },
            "summary": {"total": 0, "present": 0, "absent": 0, "rate": "0%"},
            "records": [],
            "present_list": [],
            "absent_list": []
        }
        
    # Get all admin user IDs and emails to strictly exclude from student attendance
    admin_users = db.query(User).filter(User.role == "ADMIN").all()
    admin_emails = {a.email.lower().strip() for a in admin_users if a.email}
    admin_ids = {a.id for a in admin_users}

    # Get attendance records for this session (excluding any admins)
    attendance_records = db.query(AttendanceRecord).join(User, AttendanceRecord.user_id == User.id).filter(
        AttendanceRecord.session_id == target_session.id,
        User.role == "USER"
    ).all()
    present_user_ids = {r.user_id: r for r in attendance_records}
    
    # Get all whitelisted student emails (excluding admin emails)
    allowed_list = db.query(AllowedEmail).all()
    # Also get all regular students
    regular_users = db.query(User).filter(User.role == "USER").all()
    user_by_email = {u.email.lower().strip(): u for u in regular_users}
    
    # Build student roster (Strictly non-admins)
    roster = {}
    for allowed in allowed_list:
        clean_email = allowed.email.lower().strip()
        if clean_email in admin_emails:
            continue
        user_obj = user_by_email.get(clean_email)
        if user_obj and user_obj.role == "ADMIN":
            continue
        name = user_obj.full_name if (user_obj and user_obj.full_name) else (allowed.name or "Registered Student")
        user_id = user_obj.id if user_obj else None
        roster[clean_email] = {
            "email": allowed.email,
            "name": name,
            "user_id": user_id
        }
        
    # If no whitelist entries exist, fallback to all registered regular USERs
    if not roster:
        for u in regular_users:
            clean_email = u.email.lower().strip()
            if clean_email in admin_emails:
                continue
            roster[clean_email] = {
                "email": u.email,
                "name": u.full_name,
                "user_id": u.id
            }
            
    # Also include any student who attended but might not be in whitelist
    for r in attendance_records:
        if r.user and r.user.role == "USER":
            clean_email = r.user.email.lower().strip()
            if clean_email not in admin_emails and clean_email not in roster:
                roster[clean_email] = {
                    "email": r.user.email,
                    "name": r.user.full_name,
                    "user_id": r.user.id
                }

    # Get all active linked devices
    devices = db.query(UserDevice).filter(UserDevice.is_linked == True).all()
    device_by_user_id = {d.user_id: d for d in devices if d.user_id not in admin_ids}

    records = []
    present_list = []
    absent_list = []
    present_count = 0
    absent_count = 0
    
    for email_key, student in roster.items():
        user_id = student["user_id"]
        att_record = None
        if user_id and user_id in present_user_ids:
            att_record = present_user_ids[user_id]
        
        user_dev = device_by_user_id.get(user_id) if user_id else None
        device_info = {
            "id": user_dev.id,
            "device_id": user_dev.device_id,
            "device_name": user_dev.device_name or "Web Browser",
            "is_linked": user_dev.is_linked,
            "first_linked_at": format_ist_date(user_dev.first_linked_at),
            "last_login_at": f"{format_ist_date(user_dev.last_login_at)}, {format_ist_time_short(user_dev.last_login_at)}" if user_dev.last_login_at else "—"
        } if user_dev else None

        if att_record:
            present_count += 1
            item = {
                "record_id": att_record.id,
                "user_id": user_id,
                "session_id": target_session.id,
                "name": student["name"],
                "email": student["email"],
                "date": format_ist_date(att_record.timestamp),
                "time": format_ist_time(att_record.timestamp),
                "session": f"Session {target_session.id:02d}",
                "status": "Present",
                "distance_meters": att_record.distance_meters,
                "latitude": att_record.latitude,
                "longitude": att_record.longitude,
                "device": device_info
            }
            records.append(item)
            present_list.append(item)
        else:
            absent_count += 1
            item = {
                "record_id": None,
                "user_id": user_id,
                "session_id": target_session.id,
                "name": student["name"],
                "email": student["email"],
                "date": format_ist_date(target_session.created_at),
                "time": "—",
                "session": f"Session {target_session.id:02d}",
                "status": "Absent",
                "distance_meters": None,
                "latitude": None,
                "longitude": None,
                "device": device_info
            }
            records.append(item)
            absent_list.append(item)

            
    total = len(roster)
    rate = f"{round((present_count / total) * 100)}%" if total > 0 else "0%"
    
    # Sort: Present first, then alphabetical by name
    records.sort(key=lambda x: (0 if x["status"] == "Present" else 1, x["name"].lower()))
    present_list.sort(key=lambda x: x["name"].lower())
    absent_list.sort(key=lambda x: x["name"].lower())
    
    return {
        "session": {
            "id": target_session.id,
            "status": target_session.status,
            "created_at": to_ist(target_session.created_at).isoformat() if target_session.created_at else None,
            "formatted_date": format_ist_date(target_session.created_at),
            "formatted_time": format_ist_time(target_session.created_at)
        },
        "geofence": {
            "venue_name": geofence.venue_name,
            "latitude": geofence.latitude,
            "longitude": geofence.longitude,
            "radius_meters": geofence.radius_meters
        },
        "summary": {
            "total": total,
            "present": present_count,
            "absent": absent_count,
            "rate": rate
        },
        "records": records,
        "present_list": present_list,
        "absent_list": absent_list
    }

# --- Session & OTP Endpoints ---

@router.get("/sessions")
def get_all_sessions(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    sessions = db.query(AttendanceSession).filter(AttendanceSession.admin_id == admin.id).order_by(AttendanceSession.id.desc()).all()
    result = []
    for s in sessions:
        count = db.query(AttendanceRecord).join(User, AttendanceRecord.user_id == User.id).filter(
            AttendanceRecord.session_id == s.id,
            User.role == "USER"
        ).count()
        result.append({
            "id": s.id,
            "status": s.status,
            "created_at": to_ist(s.created_at).isoformat() if s.created_at else None,
            "formatted_date": format_ist_date(s.created_at),
            "formatted_time": format_ist_time_short(s.created_at),
            "present_count": count
        })
    return result

@router.post("/session/start", response_model=OTPSessionResponse)
def start_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    # 1. Check if there's already an active session for this admin
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.admin_id == admin.id,
        AttendanceSession.status == "ACTIVE"
    ).first()
    if active_session:
        raise HTTPException(status_code=400, detail="You already have an active attendance session running.")
    
    # 2. Check 1 session per day limit per admin (IST)
    today_session = get_today_session(db, admin_id=admin.id)
    if today_session:
        raise HTTPException(
            status_code=400, 
            detail=f"Only 1 session is allowed per day. Today's session (Session #{today_session.id}) was already conducted on {format_ist_date(today_session.created_at)}."
        )
    
    new_session = AttendanceSession(admin_id=admin.id, status="ACTIVE")
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.post("/session/generate-otp", response_model=OTPResponse)
def generate_otp(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.admin_id == admin.id,
        AttendanceSession.status == "ACTIVE"
    ).first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session found for your administrator account. Start a session first.")
    
    # Invalidate previous OTPs for this session
    previous_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
    for otp in previous_otps:
        otp.status = "INVALIDATED"
    
    # Generate 6-digit random OTP
    otp_code = ''.join(random.choices(string.digits, k=6))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=30) # 30 seconds expiry
    
    new_otp = OTP(session_id=active_session.id, otp_code=otp_code, expires_at=expires_at, status="ACTIVE")
    db.add(new_otp)
    db.commit()
    db.refresh(new_otp)
    return new_otp

@router.post("/session/end")
def end_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.admin_id == admin.id,
        AttendanceSession.status == "ACTIVE"
    ).first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session to end for your administrator account.")
    
    active_session.status = "CLOSED"
    
    # Invalidate any active OTPs
    active_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
    for otp in active_otps:
        otp.status = "INVALIDATED"
        
    db.commit()
    
    # Compute report for the ended session (includes present_list and absent_list)
    report = compute_session_attendance(db, active_session.id, admin_id=admin.id)
    
    return {
        "message": "Session ended successfully",
        "session_id": active_session.id,
        "report": report
    }

@router.get("/session/current")
def get_current_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(
        AttendanceSession.admin_id == admin.id,
        AttendanceSession.status == "ACTIVE"
    ).first()
    today_session = get_today_session(db, admin_id=admin.id)
    
    active_otp = None
    if active_session:
        active_otp = db.query(OTP).filter(
            OTP.session_id == active_session.id, 
            OTP.status == "ACTIVE",
            OTP.expires_at > datetime.now(timezone.utc)
        ).order_by(OTP.created_at.desc()).first()
    
    return {
        "session": active_session.id if active_session else None,
        "today_session": {
            "id": today_session.id,
            "status": today_session.status,
            "date": format_ist_date(today_session.created_at),
            "time": format_ist_time(today_session.created_at)
        } if today_session else None,
        "today_completed": (today_session is not None and today_session.status == "CLOSED"),
        "otp": {
            "code": active_otp.otp_code if active_otp else None,
            "expires_at": active_otp.expires_at if active_otp else None,
            "status": active_otp.status if active_otp else None
        } if active_otp else None
    }


@router.get("/session/attendance")
def get_attendance(session_id: Optional[int] = None, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return compute_session_attendance(db, session_id, admin_id=admin.id)

@router.get("/session/attendance/export")
def export_attendance(session_id: Optional[int] = None, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    data = compute_session_attendance(db, session_id, admin_id=admin.id)
    records = data["records"]
    session_info = data["session"]
    session_num = f"Session_{session_info['id']:02d}" if session_info else "Attendance"
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Student Name", "Email", "Date (IST)", "Time (IST)", "Session", "Attendance Status"])
    
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
    current_ist = datetime.now(IST).strftime('%d-%m-%Y_%I-%M%p')
    return StreamingResponse(
        iter([output.getvalue()]), 
        media_type="text/csv", 
        headers={"Content-Disposition": f"attachment; filename=attendance_{session_num}_{current_ist}.csv"}
    )

@router.delete("/attendance/all")
def delete_all_attendance(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    admin_sessions = db.query(AttendanceSession).filter(AttendanceSession.admin_id == admin.id).all()
    session_ids = [s.id for s in admin_sessions]
    if session_ids:
        db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(OTP).filter(OTP.session_id.in_(session_ids)).delete(synchronize_session=False)
        db.query(AttendanceSession).filter(AttendanceSession.id.in_(session_ids)).delete(synchronize_session=False)
        db.commit()
    return {"message": "Your attendance records and sessions have been permanently deleted."}

@router.delete("/session/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    session_obj = db.query(AttendanceSession).filter(
        AttendanceSession.id == session_id,
        AttendanceSession.admin_id == admin.id
    ).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found or belongs to another administrator.")
    
    db.delete(session_obj)
    db.commit()
    return {"message": f"Session #{session_id} and its attendance records have been deleted."}

@router.delete("/attendance/record/{record_id}")
def delete_single_attendance_record(record_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    record = db.query(AttendanceRecord).join(AttendanceSession, AttendanceRecord.session_id == AttendanceSession.id).filter(
        AttendanceRecord.id == record_id,
        AttendanceSession.admin_id == admin.id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found or does not belong to your session.")
    
    db.delete(record)
    db.commit()
    return {"message": "Attendance record deleted successfully."}

@router.post("/attendance/manual-mark")
def manual_mark_attendance(payload: ManualAttendanceRequest, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    clean_email = payload.email.strip().lower()
    if not clean_email or "@" not in clean_email or "." not in clean_email:
        raise HTTPException(status_code=400, detail="A valid student email address is required.")
    
    # 1. Determine Target Session for this Admin
    if payload.session_id:
        target_session = db.query(AttendanceSession).filter(
            AttendanceSession.id == payload.session_id,
            AttendanceSession.admin_id == admin.id
        ).first()
    else:
        target_session = db.query(AttendanceSession).filter(
            AttendanceSession.admin_id == admin.id,
            AttendanceSession.status == "ACTIVE"
        ).first()
        if not target_session:
            target_session = get_today_session(db, admin_id=admin.id)
        if not target_session:
            target_session = db.query(AttendanceSession).filter(
                AttendanceSession.admin_id == admin.id
            ).order_by(AttendanceSession.id.desc()).first()
            
    if not target_session:
        raise HTTPException(status_code=400, detail="No attendance session found for your administrator account. Please start or create a session first.")
    
    # 2. Find or Provision the Student User
    user = db.query(User).filter(User.email.ilike(clean_email)).first()
    if user and user.role == "ADMIN":
        raise HTTPException(
            status_code=400,
            detail="Cannot mark attendance for an Administrator. Attendance records are strictly for students only."
        )

    if not user:
        # Check AllowedEmail for display name or use payload.name or fallback to email username
        allowed = db.query(AllowedEmail).filter(AllowedEmail.email.ilike(clean_email)).first()
        full_name = payload.name.strip() if payload.name else (allowed.name if allowed and allowed.name else clean_email.split("@")[0].replace(".", " ").title())
        import uuid
        user = User(
            email=clean_email,
            full_name=full_name,
            role="USER",
            google_id=f"manual_{uuid.uuid4().hex[:12]}"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # 3. Create or Update AttendanceRecord
    existing_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == target_session.id,
        AttendanceRecord.user_id == user.id
    ).first()

    if existing_record:
        existing_record.status = payload.status or "Present"
        existing_record.timestamp = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing_record)
        rec = existing_record
    else:
        rec = AttendanceRecord(
            session_id=target_session.id,
            user_id=user.id,
            status=payload.status or "Present",
            timestamp=datetime.now(timezone.utc),
            distance_meters=0.0
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

    return {
        "message": f"Successfully marked {user.full_name} ({user.email}) as {rec.status} for Session #{target_session.id}.",
        "record_id": rec.id,
        "user_id": user.id,
        "session_id": target_session.id,
        "name": user.full_name,
        "email": user.email,
        "status": rec.status,
        "date": format_ist_date(rec.timestamp),
        "time": format_ist_time(rec.timestamp)
    }

@router.get("/allowed-emails", response_model=List[AllowedEmailResponse])
def get_allowed_emails(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    admin_emails = {a.email.lower().strip() for a in db.query(User).filter(User.role == "ADMIN").all() if a.email}
    all_allowed = db.query(AllowedEmail).order_by(AllowedEmail.created_at.desc()).all()
    return [a for a in all_allowed if a.email.lower().strip() not in admin_emails]

@router.post("/allowed-emails", response_model=AllowedEmailResponse)
def add_allowed_email(payload: AllowedEmailCreate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    email_clean = payload.email.strip().lower()
    if not email_clean:
        raise HTTPException(status_code=400, detail="Email is required")
    
    if "@" not in email_clean or "." not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address format")
    
    # Check if this email belongs to an Administrator account
    admin_user = db.query(User).filter(func.lower(User.email) == email_clean, User.role == "ADMIN").first()
    if admin_user:
        raise HTTPException(
            status_code=400,
            detail="Cannot add an Administrator account to the Student Whitelist. Whitelist and Attendance records are strictly for students only."
        )

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
    
    admin_emails = {a.email.lower().strip() for a in db.query(User).filter(User.role == "ADMIN").all() if a.email}

    for raw_email in payload.emails:
        clean = raw_email.strip().lower()
        if not clean:
            continue
        if "@" not in clean or "." not in clean:
            skipped_count += 1
            errors.append(f"Invalid email: {raw_email}")
            continue
        
        if clean in admin_emails:
            skipped_count += 1
            errors.append(f"Skipped admin account email: {raw_email}")
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
        "message": f"Successfully added {added_count} student emails. {skipped_count} skipped.",
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

# --- Student Device Reset Endpoints ---

@router.post("/users/{user_id}/reset-device")
def reset_user_device(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Student user not found")
    
    device = db.query(UserDevice).filter(UserDevice.user_id == user_id).first()
    if not device:
        return {"message": f"No active device binding for {target_user.full_name}. Student can log in on any device."}
    
    db.delete(device)
    db.commit()
    return {
        "message": f"Device binding reset successfully for {target_user.full_name} ({target_user.email}). The student can now link a new device upon their next login."
    }

@router.post("/devices/reset-all")
def reset_all_devices(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    count = db.query(UserDevice).delete()
    db.commit()
    return {
        "message": f"All student device bindings ({count} devices) have been reset. Students can link new devices on their next login."
    }

# --- Venue Geofence Configuration Endpoints ---

@router.get("/geofence", response_model=GeofenceConfigResponse)
def get_geofence_settings(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    return get_active_geofence(db)

@router.post("/geofence", response_model=GeofenceConfigResponse)
def update_geofence_settings(payload: GeofenceConfigUpdate, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    config = get_active_geofence(db)
    if payload.venue_name:
        config.venue_name = payload.venue_name.strip()
    config.latitude = payload.latitude
    config.longitude = payload.longitude
    if payload.radius_meters > 0:
        config.radius_meters = payload.radius_meters
    config.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(config)
    return config


