from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: str
    full_name: str
    picture: Optional[str] = None
    role: str

class UserResponse(UserBase):
    id: int
    google_id: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None


class DirectLoginRequest(BaseModel):
    email: str
    full_name: str

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

