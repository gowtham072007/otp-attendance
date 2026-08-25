import random
import string
import csv
import io
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..models import User, UserDevice, DeviceAuditLog, AttendanceSession, OTP, AttendanceRecord, AllowedEmail
from ..schemas import (
    OTPSessionResponse, 
    OTPResponse, 
    AllowedEmailCreate, 
    AllowedEmailBulkCreate, 
    AllowedEmailResponse,
    DeviceResetRequest,
    UserStatusUpdateRequest,
    SetPasswordRequest
)
from ..auth.utils import get_current_admin, hash_password

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

def format_ist_full(dt: Optional[datetime]) -> str:
    ist_dt = to_ist(dt)
    return ist_dt.strftime("%d-%m-%Y, %I:%M:%S %p IST") if ist_dt else "—"

def get_today_session(db: Session) -> Optional[AttendanceSession]:
    today_ist_str = datetime.now(IST).strftime("%d-%m-%Y")
    sessions = db.query(AttendanceSession).order_by(AttendanceSession.id.desc()).all()
    for s in sessions:
        if format_ist_date(s.created_at) == today_ist_str:
            return s
    return None

# --- Helper to calculate Present and Absent students for a session ---

def compute_session_attendance(db: Session, session_id: Optional[int] = None):
    if session_id:
        target_session = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    else:
        # Check today's session first, or active session, or most recent session
        target_session = get_today_session(db)
        if not target_session:
            target_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
        if not target_session:
            target_session = db.query(AttendanceSession).order_by(AttendanceSession.id.desc()).first()
            
    if not target_session:
        return {
            "session": None,
            "summary": {"total": 0, "present": 0, "absent": 0, "rate": "0%"},
            "records": [],
            "present_list": [],
            "absent_list": []
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
    present_list = []
    absent_list = []
    present_count = 0
    absent_count = 0
    
    for email_key, student in roster.items():
        user_id = student["user_id"]
        att_record = None
        if user_id and user_id in present_user_ids:
            att_record = present_user_ids[user_id]
        
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
                "status": "Present"
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
                "status": "Absent"
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
    sessions = db.query(AttendanceSession).order_by(AttendanceSession.id.desc()).all()
    result = []
    for s in sessions:
        count = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).count()
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
    # 1. Check if there's already an active session
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if active_session:
        raise HTTPException(status_code=400, detail="An active attendance session is already running.")
    
    # 2. Check 1 session per day limit (IST)
    today_session = get_today_session(db)
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
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session found. Start a session first.")
    
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
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active session to end")
    
    active_session.status = "CLOSED"
    
    # Invalidate any active OTPs
    active_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
    for otp in active_otps:
        otp.status = "INVALIDATED"
        
    db.commit()
    
    # Compute report for the ended session (includes present_list and absent_list)
    report = compute_session_attendance(db, active_session.id)
    
    return {
        "message": "Session ended successfully",
        "session_id": active_session.id,
        "report": report
    }

@router.get("/session/current")
def get_current_session(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    today_session = get_today_session(db)
    
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
    return compute_session_attendance(db, session_id)

@router.get("/session/attendance/export")
def export_attendance(session_id: Optional[int] = None, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    data = compute_session_attendance(db, session_id)
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
    db.query(AttendanceRecord).delete()
    db.query(OTP).delete()
    db.query(AttendanceSession).delete()
    db.commit()
    return {"message": "All attendance records and sessions have been permanently deleted."}

@router.delete("/session/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    session_obj = db.query(AttendanceSession).filter(AttendanceSession.id == session_id).first()
    if not session_obj:
        raise HTTPException(status_code=404, detail="Session not found")
    
    db.delete(session_obj)
    db.commit()
    return {"message": f"Session #{session_id} and its attendance records have been deleted."}

@router.delete("/attendance/record/{record_id}")
def delete_single_attendance_record(record_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    db.delete(record)
    db.commit()
    return {"message": "Attendance record deleted successfully"}

# --- Whitelist Management Endpoints ---

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


# ==============================================================================
# --- DEVICE MANAGEMENT & AUDIT LOG ENDPOINTS ---
# ==============================================================================

@router.get("/devices")
def get_all_devices(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """
    List all users along with their linked device info, last login, and status.
    """
    users = db.query(User).order_by(User.id.desc()).all()
    results = []
    
    for u in users:
        dev = db.query(UserDevice).filter(UserDevice.user_id == u.id).first()
        results.append({
            "user_id": u.id,
            "username": u.username or u.email.split("@")[0],
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "is_linked": dev.is_linked if dev else False,
            "device_id": dev.device_id if dev else None,
            "device_name": dev.device_name if dev else None,
            "ip_address": dev.ip_address if dev else None,
            "first_linked_at": to_ist(dev.first_linked_at).isoformat() if dev and dev.first_linked_at else None,
            "first_linked_formatted": format_ist_full(dev.first_linked_at) if dev else "—",
            "last_login_at": to_ist(dev.last_login_at).isoformat() if dev and dev.last_login_at else None,
            "last_login_formatted": format_ist_full(dev.last_login_at) if dev else "—",
            "last_active_at": to_ist(dev.last_active_at).isoformat() if dev and dev.last_active_at else None,
            "last_active_formatted": format_ist_full(dev.last_active_at) if dev else "—",
        })
    return results


@router.post("/devices/{user_id}/reset")
def reset_user_device(
    user_id: int, 
    payload: Optional[DeviceResetRequest] = None, 
    db: Session = Depends(get_db), 
    admin: User = Depends(get_current_admin)
):
    """
    Admin Device Reset:
    - Unlinks the registered device for a user.
    - Records an entry in DeviceAuditLog with admin info.
    - Enables the user to log in from a new device on their next attempt.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    user_device = db.query(UserDevice).filter(UserDevice.user_id == user_id).first()
    
    old_device_id = user_device.device_id if user_device else "None"
    old_device_name = user_device.device_name if user_device else "None"
    reason = payload.reason.strip() if payload and payload.reason else "Admin initiated device reset."

    if user_device:
        # Unlink device
        user_device.is_linked = False
        user_device.last_active_at = datetime.now(timezone.utc)
    
    # Create audit log entry
    audit = DeviceAuditLog(
        user_id=target_user.id,
        admin_id=admin.id,
        action="DEVICE_RESET_BY_ADMIN",
        device_id=old_device_id,
        device_name=old_device_name,
        details=f"Device reset by Admin '{admin.full_name}' ({admin.email}). Reason: {reason}. Previous device: '{old_device_name}' (ID: {old_device_id}).",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Device unlinked successfully for user {target_user.full_name} ({target_user.email}). The user can now log in from a new device.",
        "user_id": target_user.id,
        "user_name": target_user.full_name,
        "previous_device": old_device_name
    }


@router.get("/device-audit-logs")
def get_device_audit_logs(
    limit: int = 100, 
    action: Optional[str] = None, 
    db: Session = Depends(get_db), 
    admin: User = Depends(get_current_admin)
):
    """
    Retrieve device management audit logs with user and admin details.
    """
    query = db.query(DeviceAuditLog).order_by(DeviceAuditLog.timestamp.desc())
    if action:
        query = query.filter(DeviceAuditLog.action == action)
    
    logs = query.limit(limit).all()
    results = []
    
    for l in logs:
        results.append({
            "id": l.id,
            "user_id": l.user_id,
            "user_name": l.user.full_name if l.user else "—",
            "user_email": l.user.email if l.user else "—",
            "admin_id": l.admin_id,
            "admin_name": l.admin.full_name if l.admin else None,
            "admin_email": l.admin.email if l.admin else None,
            "action": l.action,
            "device_id": l.device_id,
            "device_name": l.device_name,
            "details": l.details,
            "ip_address": l.ip_address,
            "timestamp": to_ist(l.timestamp).isoformat() if l.timestamp else None,
            "formatted_time": format_ist_full(l.timestamp)
        })
    return results


@router.post("/users/{user_id}/toggle-status")
def toggle_user_status(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """
    Enable or disable user account.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")
    
    if target_user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot disable your own admin account.")

    target_user.is_active = not target_user.is_active
    
    status_str = "ENABLED" if target_user.is_active else "DISABLED"
    audit = DeviceAuditLog(
        user_id=target_user.id,
        admin_id=admin.id,
        action="ACCOUNT_STATUS_CHANGED",
        details=f"Account status changed to {status_str} by Admin {admin.full_name}.",
        timestamp=datetime.now(timezone.utc)
    )
    db.add(audit)
    db.commit()

    return {
        "message": f"Account for {target_user.full_name} is now {status_str.lower()}.",
        "user_id": target_user.id,
        "is_active": target_user.is_active
    }


@router.post("/users/{user_id}/set-password")
def set_user_password(
    user_id: int, 
    payload: SetPasswordRequest, 
    db: Session = Depends(get_db), 
    admin: User = Depends(get_current_admin)
):
    """
    Admin can set or reset a student/user's password.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    target_user.password_hash = hash_password(payload.password)
    db.commit()

    return {"message": f"Password updated successfully for {target_user.full_name}."}


@router.get("/device-stats")
def get_device_stats(db: Session = Depends(get_db), admin: User = Depends(get_current_admin)):
    """
    Summary stats for devices and audit events.
    """
    total_users = db.query(User).filter(User.role == "USER").count()
    linked_devices = db.query(UserDevice).filter(UserDevice.is_linked == True).count()
    total_resets = db.query(DeviceAuditLog).filter(DeviceAuditLog.action == "DEVICE_RESET_BY_ADMIN").count()
    blocked_attempts = db.query(DeviceAuditLog).filter(DeviceAuditLog.action == "LOGIN_BLOCKED_MISMATCH").count()

    return {
        "total_users": total_users,
        "linked_devices": linked_devices,
        "unlinked_users": max(total_users - linked_devices, 0),
        "total_resets": total_resets,
        "blocked_attempts": blocked_attempts
    }


