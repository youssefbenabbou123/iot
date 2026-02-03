from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DeviceDataResponse(BaseModel):
    _id: Optional[str] = None
    device_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    cpu: Optional[float] = None
    memory_percent: Optional[float] = None
    disk_percent: Optional[float] = None
    status: Optional[str] = None
    timestamp: str
    event_type: Optional[str] = None


class DeviceDataRequest(BaseModel):
    device_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    status: Optional[str] = None
    timestamp: Optional[str] = None
