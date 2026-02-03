from pydantic import BaseModel, Field
from typing import Optional


class DeviceRequest(BaseModel):
    device_id: str = Field(..., min_length=1, description="Unique device identifier")
    name: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = Field(default="offline")
    location: Optional[str] = None
    temperature: Optional[float] = None


class DeviceResponse(BaseModel):
    id: int
    device_id: str
    name: Optional[str]
    device_type: Optional[str]
    status: str
    location: Optional[str]
    temperature: Optional[float]
    created_at: str
    updated_at: str


class DeviceDataRequest(BaseModel):
    device_id: str
    temperature: Optional[float] = None
    status: Optional[str] = None
    cpu_percent: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
