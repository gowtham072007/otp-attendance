from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
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
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

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
