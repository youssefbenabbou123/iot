from typing import List
from fastapi import APIRouter, Depends, HTTPException, Security
from sqlalchemy.orm import Session
from helpers.config import session_factory, logger
from helpers.jwt_verifier import verify_jwt_token
from helpers.redis_cache import (
    cache_get, cache_set, cache_invalidate_devices, cache_invalidate_device,
)
from business.device_service import DeviceService
from dto.device_dto import DeviceRequest, DeviceResponse, DeviceDataRequest
from entities.device import Device

router = APIRouter(prefix="/devices", tags=["devices"])
device_service = DeviceService()


def device_to_response(device: Device) -> DeviceResponse:
    """Convert Device entity to DeviceResponse DTO"""
    return DeviceResponse(
        id=device.id,
        device_id=device.device_id,
        name=device.name,
        device_type=device.device_type,
        status=device.status,
        location=device.location,
        temperature=device.temperature,
        created_at=str(device.created_at),
        updated_at=str(device.updated_at),
    )


@router.post("/", response_model=DeviceResponse, status_code=201)
async def add_device(
    device_request: DeviceRequest,
    session: Session = Depends(session_factory),
    payload: dict = Security(verify_jwt_token),
):
    """Add a new device (requires authentication)"""
    device_data = device_request.dict()
    device = device_service.add_device(session, device_data)
    if not device:
        raise HTTPException(status_code=400, detail="Device with this ID already exists")
    cache_invalidate_devices()
    return device_to_response(device)


@router.get("/", response_model=List[DeviceResponse])
async def get_devices(
    session: Session = Depends(session_factory),
    payload: dict = Security(verify_jwt_token),
):
    """Get all devices (requires authentication). Cache Redis optionnel."""
    cached = cache_get("devices:all")
    if cached is not None:
        return [DeviceResponse(**d) for d in cached]
    devices = device_service.get_all_devices(session)
    result = [device_to_response(device) for device in devices]
    cache_set("devices:all", [r.model_dump() if hasattr(r, "model_dump") else r.dict() for r in result])
    return result


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    session: Session = Depends(session_factory),
    payload: dict = Security(verify_jwt_token),
):
    """Get device by ID (requires authentication). Cache Redis optionnel."""
    cached = cache_get(f"device:{device_id}")
    if cached is not None:
        return DeviceResponse(**cached)
    device = device_service.get_device(session, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    result = device_to_response(device)
    cache_set(f"device:{device_id}", result.model_dump() if hasattr(result, "model_dump") else result.dict())
    return result


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    device_request: DeviceRequest,
    session: Session = Depends(session_factory),
    payload: dict = Security(verify_jwt_token),
):
    """Update device (requires authentication)"""
    update_data = device_request.dict(exclude_unset=True)
    device = device_service.update_device(session, device_id, update_data)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    cache_invalidate_devices()
    cache_invalidate_device(device_id)
    return device_to_response(device)


@router.delete("/{device_id}", status_code=204)
async def delete_device(
    device_id: str,
    session: Session = Depends(session_factory),
    payload: dict = Security(verify_jwt_token),
):
    """Delete device (requires authentication)"""
    success = device_service.delete_device(session, device_id)
    if not success:
        raise HTTPException(status_code=404, detail="Device not found")
    cache_invalidate_devices()
    cache_invalidate_device(device_id)
    return None


@router.post("/{device_id}/data", response_model=DeviceResponse)
async def receive_device_data(
    device_id: str,
    data_request: DeviceDataRequest,
    session: Session = Depends(session_factory),
):
    """
    Receive data from IoT device (no authentication required for devices)
    This endpoint publishes data to RabbitMQ for the Monitoring service
    """
    data = data_request.dict(exclude_unset=True)
    device = device_service.receive_device_data(session, device_id, data)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    cache_invalidate_devices()
    cache_invalidate_device(device_id)
    return device_to_response(device)
