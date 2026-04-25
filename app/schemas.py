from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional


class SensorCreate(BaseModel):
    device_id: int
    measurement_type_id: int
    name: str
    location: Optional[str] = None

class SensorUpdate(BaseModel):
    device_id: Optional[int] = None
    measurement_type_id: Optional[int] = None
    name: Optional[str] = None
    location: Optional[str] = None

class DeviceCreate(BaseModel):
    name: str
    passkey: str
    serial_number: Optional[str] = None
    location_name: Optional[str] = None

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    passkey: Optional[str] = None
    serial_number: Optional[str] = None
    location_name: Optional[str] = None
    status: Optional[str] = None

class MeasurementTypeCreate(BaseModel):
    name: str
    unit: str

class MeasurementTypeUpdate(BaseModel):
    name: Optional[str] = None
    unit: Optional[str] = None

class UserBase(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role: str = "user"

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    created_at: datetime
    roles: list[str] = []

    model_config = ConfigDict(from_attributes=True)

class MeasurementCreate(BaseModel):
    sensor_id: int
    ts: datetime
    value: float

class MeasurementResponse(BaseModel):
    id: int
    sensor_id: int
    ts: datetime
    value: float

    model_config = ConfigDict(from_attributes=True)

class DeviceResponse(BaseModel):
    id: int
    user_id: int | None = None
    name: str
    serial_number: str | None = None
    location_name: str | None = None
    status: str | None = None

    model_config = ConfigDict(from_attributes=True)

class SensorResponse(BaseModel):
    id: int
    device_id: int
    measurement_type_id: int
    name: str | None = None
    location: str | None = None

    model_config = ConfigDict(from_attributes=True)

class MeasurementStatsResponse(BaseModel):
    sensor_id: int
    min_value: float | None
    max_value: float | None
    avg_value: float | None


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
