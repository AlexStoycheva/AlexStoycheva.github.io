from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

class UserBase(BaseModel):
    email: EmailStr
    first_name: str | None = None
    last_name: str | None = None
    is_active: bool = True

class UserResponse(UserBase):
    id: int
    created_at: datetime

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