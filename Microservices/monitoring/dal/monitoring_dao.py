from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from helpers.config import collection, logger


def insert_device_data(data: Dict[str, Any]) -> bool:
    """Insert device data into MongoDB"""
    try:
        document = {
            "device_id": data.get("device_id"),
            "temperature": data.get("temperature"),
            "humidity": data.get("humidity"),
            "status": data.get("status"),
            "timestamp": data.get("timestamp", datetime.utcnow().isoformat()),
            "event_type": data.get("event_type", "device.data"),
        }
        collection.insert_one(document)
        logger.info(f"Data inserted for device {data.get('device_id')}")
        return True
    except Exception as e:
        logger.error(f"Error inserting data: {e}")
        return False


def get_all_data(limit: int = 100) -> List[Dict[str, Any]]:
    """Get all device data from MongoDB"""
    try:
        cursor = collection.find().sort("timestamp", -1).limit(limit)
        data = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])  # Convert ObjectId to string
            data.append(doc)
        return data
    except Exception as e:
        logger.error(f"Error fetching all data: {e}")
        return []


def get_data_by_device_id(device_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Get data for a specific device"""
    try:
        cursor = (
            collection.find({"device_id": device_id})
            .sort("timestamp", -1)
            .limit(limit)
        )
        data = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            data.append(doc)
        return data
    except Exception as e:
        logger.error(f"Error fetching data for device {device_id}: {e}")
        return []


def get_latest_data_by_device_id(device_id: str) -> Optional[Dict[str, Any]]:
    """Get latest data for a specific device"""
    try:
        doc = collection.find_one(
            {"device_id": device_id}, sort=[("timestamp", -1)]
        )
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        return None
    except Exception as e:
        logger.error(f"Error fetching latest data for device {device_id}: {e}")
        return None


def get_data_by_time_range(
    device_id: str, start_time: datetime, end_time: datetime
) -> List[Dict[str, Any]]:
    """Get data for a device within a time range"""
    try:
        cursor = (
            collection.find(
                {
                    "device_id": device_id,
                    "timestamp": {
                        "$gte": start_time.isoformat(),
                        "$lte": end_time.isoformat(),
                    },
                }
            )
            .sort("timestamp", -1)
        )
        data = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            data.append(doc)
        return data
    except Exception as e:
        logger.error(f"Error fetching data by time range: {e}")
        return []
