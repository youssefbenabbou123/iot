from helpers.config import Base
from sqlalchemy import Column, String, Integer, DateTime, func, Float, Boolean


class Device(Base):
    __tablename__ = "devices"
    id = Column(Integer, primary_key=True, autoincrement=True, nullable=False, index=True)
    device_id = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=True)
    device_type = Column(String(100), nullable=True)
    status = Column(String(50), default="offline", nullable=False)
    location = Column(String(200), nullable=True)
    temperature = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), server_onupdate=func.now())
