from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from dal.device_dao import (
    create_device,
    get_all_devices,
    get_device_by_id,
    update_device,
    delete_device,
)
from entities.device import Device
from helpers.rabbitmq_publisher import rabbitmq_publisher
from helpers.config import logger


class DeviceService:
    def add_device(self, session: Session, device_data: Dict[str, Any]) -> Optional[Device]:
        """Add a new device and publish event to RabbitMQ"""
        device = Device(
            device_id=device_data.get("device_id"),
            name=device_data.get("name"),
            device_type=device_data.get("device_type"),
            status=device_data.get("status", "offline"),
            location=device_data.get("location"),
            temperature=device_data.get("temperature"),
        )

        created_device = create_device(session, device)
        if created_device:
            # Publish event to RabbitMQ
            try:
                rabbitmq_publisher.publish_device_event(
                    "created",
                    {
                        "device_id": created_device.device_id,
                        "name": created_device.name,
                        "status": created_device.status,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to publish device.created event: {e}")

        return created_device

    def get_all_devices(self, session: Session) -> List[Device]:
        """Get all devices"""
        return get_all_devices(session)

    def get_device(self, session: Session, device_id: str) -> Optional[Device]:
        """Get device by ID"""
        return get_device_by_id(session, device_id)

    def update_device(
        self, session: Session, device_id: str, update_data: Dict[str, Any]
    ) -> Optional[Device]:
        """Update device and publish event to RabbitMQ"""
        updated_device = update_device(session, device_id, update_data)
        if updated_device:
            # Publish event to RabbitMQ
            try:
                rabbitmq_publisher.publish_device_event(
                    "updated",
                    {
                        "device_id": updated_device.device_id,
                        "status": updated_device.status,
                        "temperature": updated_device.temperature,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to publish device.updated event: {e}")

        return updated_device

    def delete_device(self, session: Session, device_id: str) -> bool:
        """Delete device and publish event to RabbitMQ"""
        success = delete_device(session, device_id)
        if success:
            # Publish event to RabbitMQ
            try:
                rabbitmq_publisher.publish_device_event(
                    "deleted",
                    {
                        "device_id": device_id,
                        "timestamp": datetime.utcnow().isoformat(),
                    },
                )
            except Exception as e:
                logger.error(f"Failed to publish device.deleted event: {e}")

        return success

    def receive_device_data(
        self, session: Session, device_id: str, data: Dict[str, Any]
    ) -> Optional[Device]:
        """Receive data from IoT device and publish to RabbitMQ"""
        device = get_device_by_id(session, device_id)
        if not device:
            logger.warning(f"Device {device_id} not found")
            return None

        # Update device with new data
        update_data = {}
        if "temperature" in data:
            update_data["temperature"] = data["temperature"]
        if "status" in data:
            update_data["status"] = data["status"]

        updated_device = update_device(session, device_id, update_data)

        # Publish data event to RabbitMQ for Monitoring service (incl. CPU/RAM/disk des end-devices)
        try:
            payload = {
                "device_id": device_id,
                "temperature": data.get("temperature"),
                "status": data.get("status"),
                "timestamp": datetime.utcnow().isoformat(),
            }
            if data.get("cpu_percent") is not None:
                payload["cpu"] = data.get("cpu_percent")
            if data.get("memory_percent") is not None:
                payload["memory_percent"] = data.get("memory_percent")
            if data.get("disk_percent") is not None:
                payload["disk_percent"] = data.get("disk_percent")
            rabbitmq_publisher.publish_device_event("data", payload)
        except Exception as e:
            logger.error(f"Failed to publish device.data event: {e}")

        return updated_device
