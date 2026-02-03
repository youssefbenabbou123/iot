from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dal.monitoring_dao import (
    insert_device_data,
    get_all_data,
    get_data_by_device_id,
    get_latest_data_by_device_id,
    get_data_by_time_range,
)


class MonitoringService:
    def save_device_data(self, data: Dict[str, Any]) -> bool:
        """Save device data to MongoDB"""
        return insert_device_data(data)

    def get_all_device_data(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get all device data"""
        return get_all_data(limit)

    def get_device_data(self, device_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get data for a specific device"""
        return get_data_by_device_id(device_id, limit)

    def get_latest_device_data(self, device_id: str) -> Optional[Dict[str, Any]]:
        """Get latest data for a specific device"""
        return get_latest_data_by_device_id(device_id)

    def get_device_data_by_time_range(
        self, device_id: str, start_time: datetime, end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Get device data within a time range"""
        return get_data_by_time_range(device_id, start_time, end_time)
