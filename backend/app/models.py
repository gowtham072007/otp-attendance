from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=True)
    full_name = Column(String)
    picture = Column(String, nullable=True)
    role = Column(String, default="USER") # ADMIN or USER
    is_active = Column(Boolean, default=True) # Account enabled/disabled
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    device = relationship("UserDevice", back_populates="user", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("DeviceAuditLog", back_populates="user", foreign_keys="[DeviceAuditLog.user_id]", cascade="all, delete-orphan")

class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    device_id = Column(String, index=True, nullable=False) # Unique device UUID / fingerprint
    device_name = Column(String, nullable=True) # e.g. "Chrome on Windows 11"
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    is_linked = Column(Boolean, default=True)
    first_linked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_active_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="device")

class DeviceAuditLog(Base):
    __tablename__ = "device_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True) # Null if user or system action
    action = Column(String, nullable=False) # DEVICE_REGISTERED, DEVICE_RESET_BY_ADMIN, DEVICE_UNLINKED, LOGIN_BLOCKED_MISMATCH, LOGIN_SUCCESS, ACCOUNT_STATUS_CHANGED
    device_id = Column(String, nullable=True)
    device_name = Column(String, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id], back_populates="audit_logs")
    admin = relationship("User", foreign_keys=[admin_id])

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="ACTIVE") # ACTIVE, CLOSED
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    admin = relationship("User")
    otps = relationship("OTP", back_populates="session", cascade="all, delete-orphan")
    attendances = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

class OTP(Base):
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"))
    otp_code = Column(String, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime)
    status = Column(String, default="ACTIVE") # ACTIVE, EXPIRED, INVALIDATED

    session = relationship("AttendanceSession", back_populates="otps")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("attendance_sessions.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="Present")
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("AttendanceSession", back_populates="attendances")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint('session_id', 'user_id', name='_session_user_uc'),
    )

class AllowedEmail(Base):
    __tablename__ = "allowed_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


