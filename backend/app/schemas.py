from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: str
    full_name: str
    picture: Optional[str] = None
    role: str

class UserDeviceResponse(BaseModel):
    id: int
    device_id: str
    device_name: Optional[str] = None
    is_linked: bool = True
    first_linked_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int
    google_id: str
    created_at: datetime
    is_master_admin: bool = False
    device: Optional[UserDeviceResponse] = None
    register_number: Optional[str] = None
    student_id: Optional[str] = None
    studentId: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    student_status: Optional[str] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None


class DirectLoginRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    device_id: Optional[str] = None
    device_name: Optional[str] = None

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class AdminRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str

class OTPSessionResponse(BaseModel):
    id: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class OTPResponse(BaseModel):
    otp_code: str
    expires_at: datetime
    status: str
    
    class Config:
        from_attributes = True

class AttendanceRecordResponse(BaseModel):
    id: int
    user: UserResponse
    timestamp: datetime
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_meters: Optional[float] = None
    
    class Config:
        from_attributes = True

class AttendanceSubmission(BaseModel):
    otp_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class GeofenceConfigResponse(BaseModel):
    id: int
    venue_name: str
    latitude: float
    longitude: float
    radius_meters: float
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class GeofenceConfigUpdate(BaseModel):
    venue_name: Optional[str] = "Francis Xavier Engineering College"
    latitude: float
    longitude: float
    radius_meters: float = 500.0

class ManualAttendanceRequest(BaseModel):
    email: str
    name: Optional[str] = None
    session_id: Optional[int] = None
    status: Optional[str] = "Present"

class AutoOTPRequest(BaseModel):
    latitude: float
    longitude: float

class AutoOTPResponse(BaseModel):
    message: str
    otp_code: str
    session_id: int
    expires_at: Optional[datetime] = None
    email_sent: bool
    student_email: str
    distance_meters: float
    venue_name: Optional[str] = None

class AdminAccountSummary(BaseModel):
    id: int
    full_name: Optional[str] = "Administrator"
    email: str
    is_master: bool = False
    is_approved: bool = True
    sessions_count: int = 0
    active_session_id: Optional[int] = None
    students_count: int = 0
    whitelisted_students_count: int = 0
    total_attendance_marked: int = 0
    created_at: Optional[str] = None

class CreateAdminByMasterRequest(BaseModel):
    full_name: str
    email: str
    password: str

class AdminRegisterResponse(BaseModel):
    message: str
    is_approved: bool
    access_token: Optional[str] = None
    token_type: Optional[str] = None
    user: Optional[UserResponse] = None

# --- Student Management Schemas ---

class StudentBase(BaseModel):
    name: str
    register_number: str
    email: str
    phone: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    status: Optional[str] = "Active"

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    register_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    status: Optional[str] = None

class StudentResponse(BaseModel):
    id: int
    name: str
    register_number: str
    email: str
    phone: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    status: str = "Active"
    admin_id: int
    admin_name: Optional[str] = None
    admin_email: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MasterAdminStudentStats(BaseModel):
    total_students: int
    active_students: int
    inactive_students: int
    departments_count: int
    admins_count: int

class StudentBulkImportItem(BaseModel):
    name: str
    register_number: str
    email: str
    phone: Optional[str] = None
    department: Optional[str] = None
    year: Optional[str] = None
    status: Optional[str] = "Active"

class StudentBulkImportRequest(BaseModel):
    students: List[StudentBulkImportItem]

class StudentBulkImportResponse(BaseModel):
    total_received: int
    added_count: int
    skipped_count: int
    added_students: List[StudentResponse] = []
    errors: List[str] = []

