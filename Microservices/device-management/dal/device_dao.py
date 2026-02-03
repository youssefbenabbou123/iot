from typing import List, Optional
from sqlalchemy.orm import Session
from entities.device import Device
from helpers.config import logger


def create_device(session: Session, device: Device) -> Optional[Device]:
    """Create a new device"""
    try:
        # Check if device_id already exists
        existing = (
            session.query(Device)
            .filter(Device.device_id == device.device_id)
            .one_or_none()
        )
        if existing:
            logger.warning(f"Device with ID {device.device_id} already exists")
            return None

        session.add(device)
        session.commit()
        session.refresh(device)
        logger.info(f"Device created: {device.device_id}")
        return device
    except Exception as e:
        session.rollback()
        logger.error(f"Error creating device: {e}")
        return None


def get_all_devices(session: Session) -> List[Device]:
    """Get all devices"""
    try:
        return session.query(Device).all()
    except Exception as e:
        logger.error(f"Error fetching devices: {e}")
        return []


def get_device_by_id(session: Session, device_id: str) -> Optional[Device]:
    """Get device by device_id"""
    try:
        return (
            session.query(Device)
            .filter(Device.device_id == device_id)
            .one_or_none()
        )
    except Exception as e:
        logger.error(f"Error fetching device {device_id}: {e}")
        return None


def update_device(session: Session, device_id: str, update_data: dict) -> Optional[Device]:
    """Update device"""
    try:
        device = (
            session.query(Device)
            .filter(Device.device_id == device_id)
            .one_or_none()
        )
        if not device:
            return None

        for key, value in update_data.items():
            if hasattr(device, key) and value is not None:
                setattr(device, key, value)

        session.commit()
        session.refresh(device)
        logger.info(f"Device updated: {device_id}")
        return device
    except Exception as e:
        session.rollback()
        logger.error(f"Error updating device {device_id}: {e}")
        return None


def delete_device(session: Session, device_id: str) -> bool:
    """Delete device"""
    try:
        device = (
            session.query(Device)
            .filter(Device.device_id == device_id)
            .one_or_none()
        )
        if not device:
            return False

        session.delete(device)
        session.commit()
        logger.info(f"Device deleted: {device_id}")
        return True
    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting device {device_id}: {e}")
        return False
