from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Text, Float
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime, timezone

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    google_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    full_name = Column(String)
    picture = Column(String, nullable=True)
    role = Column(String, default="USER") # ADMIN or USER
    hashed_password = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Strict 1 User per Device relationship
    device = relationship("UserDevice", back_populates="user", uselist=False, cascade="all, delete-orphan")

class UserDevice(Base):
    __tablename__ = "user_devices"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    device_id = Column(String, unique=True, index=True, nullable=False) # Unique device UUID / fingerprint
    device_name = Column(String, nullable=True) # e.g. "Chrome on Windows 10/11"
    user_agent = Column(Text, nullable=True)
    ip_address = Column(String, nullable=True)
    is_linked = Column(Boolean, default=True)
    first_linked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="device")

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
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    distance_meters = Column(Float, nullable=True)
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

class GeofenceConfig(Base):
    __tablename__ = "geofence_configs"

    id = Column(Integer, primary_key=True, index=True)
    venue_name = Column(String, default="Francis Xavier Engineering College")
    latitude = Column(Float, default=8.732309)
    longitude = Column(Float, default=77.723764)
    radius_meters = Column(Float, default=500.0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


