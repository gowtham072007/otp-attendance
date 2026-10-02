from typing import Any, Optional
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint, Text, Float
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id: Any = Column(Integer, primary_key=True, index=True)
    google_id: Any = Column(String, unique=True, index=True)
    email: Any = Column(String, unique=True, index=True)
    full_name: Any = Column(String)
    picture: Any = Column(String, nullable=True)
    role: Any = Column(String, default="USER") # ADMIN or USER
    is_approved: Any = Column(Boolean, default=True) # For ADMIN accounts, requires Master Admin approval if registered
    hashed_password: Any = Column(String, nullable=True)
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Strict 1 User per Device relationship
    device = relationship("UserDevice", back_populates="user", uselist=False, cascade="all, delete-orphan")
    students = relationship("Student", back_populates="admin", cascade="all, delete-orphan")
    class_links = relationship("AdminClassLink", back_populates="admin", foreign_keys="AdminClassLink.admin_id", cascade="all, delete-orphan")

class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Any = Column(Integer, primary_key=True, index=True)
    user_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    device_id: Any = Column(String, unique=True, index=True, nullable=False) # Unique device UUID / fingerprint
    device_name: Any = Column(String, nullable=True) # e.g. "Chrome on Windows 10/11"
    user_agent: Any = Column(Text, nullable=True)
    ip_address: Any = Column(String, nullable=True)
    is_linked: Any = Column(Boolean, default=True)
    first_linked_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_login_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="device")

class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"

    id: Any = Column(Integer, primary_key=True, index=True)
    admin_id: Any = Column(Integer, ForeignKey("users.id"))
    status: Any = Column(String, default="ACTIVE") # ACTIVE, CLOSED
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    admin = relationship("User")
    otps = relationship("OTP", back_populates="session", cascade="all, delete-orphan")
    attendances = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")

class OTP(Base):
    __tablename__ = "otps"

    id: Any = Column(Integer, primary_key=True, index=True)
    session_id: Any = Column(Integer, ForeignKey("attendance_sessions.id"))
    otp_code: Any = Column(String, index=True)
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at: Any = Column(DateTime)
    status: Any = Column(String, default="ACTIVE") # ACTIVE, EXPIRED, INVALIDATED

    session = relationship("AttendanceSession", back_populates="otps")

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Any = Column(Integer, primary_key=True, index=True)
    session_id: Any = Column(Integer, ForeignKey("attendance_sessions.id"))
    user_id: Any = Column(Integer, ForeignKey("users.id"))
    status: Any = Column(String, default="Present")
    latitude: Any = Column(Float, nullable=True)
    longitude: Any = Column(Float, nullable=True)
    distance_meters: Any = Column(Float, nullable=True)
    timestamp: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("AttendanceSession", back_populates="attendances")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint('session_id', 'user_id', name='_session_user_uc'),
    )

class AllowedEmail(Base):
    __tablename__ = "allowed_emails"

    id: Any = Column(Integer, primary_key=True, index=True)
    admin_id: Any = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    email: Any = Column(String, index=True, nullable=False)
    name: Any = Column(String, nullable=True)
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    admin = relationship("User")

    __table_args__ = (
        UniqueConstraint('admin_id', 'email', name='_admin_email_uc'),
    )

class GeofenceConfig(Base):
    __tablename__ = "geofence_configs"

    id: Any = Column(Integer, primary_key=True, index=True)
    venue_name: Any = Column(String, default="Francis Xavier Engineering College")
    latitude: Any = Column(Float, default=8.732309)
    longitude: Any = Column(Float, default=77.723764)
    radius_meters: Any = Column(Float, default=500.0)
    updated_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Student(Base):
    __tablename__ = "students"

    id: Any = Column(Integer, primary_key=True, index=True)
    name: Any = Column(String, nullable=False)
    register_number: Any = Column(String, unique=True, index=True, nullable=False)
    email: Any = Column(String, index=True, nullable=False)
    phone: Any = Column(String, nullable=True)
    department: Any = Column(String, nullable=True)
    year: Any = Column(String, nullable=True)
    section: Any = Column(String, nullable=True, default="A") # e.g. A, B, C
    status: Any = Column(String, default="Active") # Active, Inactive
    admin_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    admin = relationship("User", back_populates="students")

    __table_args__ = (
        UniqueConstraint('register_number', name='_student_register_number_uc'),
    )


class AdminClassLink(Base):
    __tablename__ = "admin_class_links"

    id: Any = Column(Integer, primary_key=True, index=True)
    admin_id: Any = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    department: Any = Column(String, nullable=False, index=True)
    year: Any = Column(String, nullable=False, index=True)
    section: Any = Column(String, nullable=False, default="A", index=True)
    created_by_id: Any = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Any = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    admin = relationship("User", back_populates="class_links", foreign_keys=[admin_id])
    creator = relationship("User", foreign_keys=[created_by_id])

    __table_args__ = (
        UniqueConstraint('admin_id', 'department', 'year', 'section', name='_admin_class_section_uc'),
    )


