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
    device: Optional[UserDeviceResponse] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None


class DirectLoginRequest(BaseModel):
    email: str
    full_name: str
    device_id: Optional[str] = None
    device_name: Optional[str] = None

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

