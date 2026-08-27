import os
import math
import random
import string
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
try:
    from ..database import get_db
    from ..models import User, AttendanceSession, OTP, AttendanceRecord, GeofenceConfig
    from ..schemas import AttendanceSubmission, AutoOTPRequest, AutoOTPResponse
    from ..auth.utils import get_current_user
    from ..utils.email_service import send_otp_email
except (ImportError, ValueError):
    from app.database import get_db
    from app.models import User, AttendanceSession, OTP, AttendanceRecord, GeofenceConfig
    from app.schemas import AttendanceSubmission, AutoOTPRequest, AutoOTPResponse
    from app.auth.utils import get_current_user
    from app.utils.email_service import send_otp_email

router = APIRouter(prefix="/attendance", tags=["attendance"])

def calculate_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth using Haversine formula."""
    R = 6371000.0  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

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
    geofence = get_active_geofence(db)
    
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
            "distance_meters": my_record.distance_meters,
            "session": f"Session {target_session.id:02d}"
        } if my_record else None,
        "target_location": {
            "venue_name": geofence.venue_name,
            "latitude": geofence.latitude,
            "longitude": geofence.longitude,
            "radius_meters": geofence.radius_meters
        }
    }


@router.post("/auto-otp", response_model=AutoOTPResponse)
def auto_dispatch_otp(
    payload: AutoOTPRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Automatically verifies student GPS location against the geofence and dispatches
    the active attendance OTP to the student's device and registered email.
    """
    # 1. Device lock check (for students)
    if current_user.role == "USER" and current_user.device:
        client_device_id = request.headers.get("X-Device-Id")
        if client_device_id and current_user.device.device_id != client_device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device Mismatch: OTP can only be requested from your registered device."
            )

    # 2. Check active session
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(
            status_code=400,
            detail="No active attendance session currently running."
        )

    # 3. Check if user already marked attendance
    existing_record = db.query(AttendanceRecord).filter(
        AttendanceRecord.session_id == active_session.id,
        AttendanceRecord.user_id == current_user.id
    ).first()
    if existing_record:
        raise HTTPException(
            status_code=400,
            detail="You have already marked attendance for this session."
        )

    # 4. Geofence location verification
    if payload.latitude is None or payload.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="GPS coordinates required to verify you are inside the attendance venue."
        )

    geofence = get_active_geofence(db)
    distance = calculate_distance_meters(
        payload.latitude, payload.longitude,
        geofence.latitude, geofence.longitude
    )

    if distance > geofence.radius_meters:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Location verification failed: You are outside the attendance zone (~{int(distance)}m away from {geofence.venue_name}). You must be within {int(geofence.radius_meters)}m to receive the OTP."
        )

    # 5. Get active unexpired OTP or generate one for this active session
    now_utc = datetime.now(timezone.utc)
    active_otp = db.query(OTP).filter(
        OTP.session_id == active_session.id,
        OTP.status == "ACTIVE",
        OTP.expires_at > now_utc
    ).order_by(OTP.created_at.desc()).first()

    if not active_otp:
        # Invalidate old OTPs
        old_otps = db.query(OTP).filter(OTP.session_id == active_session.id, OTP.status == "ACTIVE").all()
        for old in old_otps:
            old.status = "INVALIDATED"
        
        # Generate fresh OTP valid for 60 seconds
        otp_code = ''.join(random.choices(string.digits, k=6))
        expires_at = now_utc + timedelta(seconds=60)
        active_otp = OTP(
            session_id=active_session.id,
            otp_code=otp_code,
            expires_at=expires_at,
            status="ACTIVE"
        )
        db.add(active_otp)
        db.commit()
        db.refresh(active_otp)

    # 6. Send Email in background task
    background_tasks.add_task(
        send_otp_email,
        to_email=current_user.email,
        student_name=current_user.full_name or "Student",
        otp_code=active_otp.otp_code,
        session_id=active_session.id,
        venue_name=geofence.venue_name
    )

    return {
        "message": f"Location verified! OTP sent to {current_user.email} and delivered to your device.",
        "otp_code": active_otp.otp_code,
        "session_id": active_session.id,
        "expires_at": active_otp.expires_at,
        "email_sent": True,
        "student_email": current_user.email,
        "distance_meters": round(distance, 1),
        "venue_name": geofence.venue_name
    }


@router.post("/mark")
def mark_attendance(submission: AttendanceSubmission, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Device lock check
    if current_user.role == "USER" and current_user.device:
        client_device_id = request.headers.get("X-Device-Id")
        if client_device_id and current_user.device.device_id != client_device_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Device Mismatch: Attendance must be submitted from your registered device."
            )

    # Find active session
    active_session = db.query(AttendanceSession).filter(AttendanceSession.status == "ACTIVE").first()
    if not active_session:
        raise HTTPException(status_code=400, detail="No active attendance session.")

    # Geofence location verification
    if submission.latitude is None or submission.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Location required. Please allow GPS access in your browser to verify you are inside the attendance venue."
        )

    geofence = get_active_geofence(db)

    distance = calculate_distance_meters(
        submission.latitude, submission.longitude,
        geofence.latitude, geofence.longitude
    )

    if distance > geofence.radius_meters:
        raise HTTPException(
            status_code=403,
            detail=f"Location verification failed: You are outside the attendance zone (~{int(distance)}m away from {geofence.venue_name}). You must be within {int(geofence.radius_meters)}m of the venue."
        )
    
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
            status="Present",
            latitude=submission.latitude,
            longitude=submission.longitude,
            distance_meters=round(distance, 1)
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
        "status": new_attendance.status,
        "distance_meters": round(distance, 1)
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

