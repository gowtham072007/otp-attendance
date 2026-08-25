from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# --- Device Schemas ---

class UserDeviceBase(BaseModel):
    device_id: str
    device_name: Optional[str] = None
    is_linked: bool = True

class UserDeviceResponse(UserDeviceBase):
    id: int
    user_id: int
    user_agent: Optional[str] = None
    ip_address: Optional[str] = None
    first_linked_at: datetime
    last_login_at: datetime
    last_active_at: datetime

    class Config:
        from_attributes = True

# --- User Schemas ---

class UserBase(BaseModel):
    email: str
    username: Optional[str] = None
    full_name: str
    picture: Optional[str] = None
    role: str
    is_active: bool = True

class UserResponse(UserBase):
    id: int
    google_id: Optional[str] = None
    created_at: datetime
    device: Optional[UserDeviceResponse] = None
    
    class Config:
        from_attributes = True

class UserWithDeviceResponse(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    device: Optional[UserDeviceResponse] = None

    class Config:
        from_attributes = True

# --- Authentication Schemas ---

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None
    device_id: Optional[str] = None

class LoginRequest(BaseModel):
    identifier: str # Username or Email
    password: Optional[str] = None
    full_name: Optional[str] = None
    device_id: str
    device_name: Optional[str] = None

class DirectLoginRequest(BaseModel):
    email: str
    full_name: str
    device_id: Optional[str] = "browser_default"
    device_name: Optional[str] = "Standard Web Browser"

class GoogleLoginRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    picture: Optional[str] = None
    device_id: str
    device_name: Optional[str] = None

class RegisterRequest(BaseModel):
    email: str
    username: Optional[str] = None
    full_name: str
    password: str
    device_id: str
    device_name: Optional[str] = None

class DeviceResetRequest(BaseModel):
    reason: Optional[str] = None

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class SetPasswordRequest(BaseModel):
    password: str

# --- Audit Log Schemas ---

class DeviceAuditLogResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    admin_id: Optional[int] = None
    admin_email: Optional[str] = None
    admin_name: Optional[str] = None
    action: str
    device_id: Optional[str] = None
    device_name: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    timestamp: datetime
    formatted_time: Optional[str] = None

    class Config:
        from_attributes = True

# --- Attendance & OTP Schemas ---

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
    
    class Config:
        from_attributes = True

class AttendanceSubmission(BaseModel):
    otp_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class AllowedEmailCreate(BaseModel):
    email: str
    name: Optional[str] = None

class AllowedEmailBulkCreate(BaseModel):
    emails: List[str]

class AllowedEmailResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


