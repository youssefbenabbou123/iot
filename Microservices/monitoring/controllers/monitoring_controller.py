from typing import List, Optional, Any
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
from business.monitoring_service import MonitoringService
from business.prediction_service import predict_temperature
from business.weather_analysis import compute_weather_analysis
from business.prediction_24h import predict_24h_blended
from models.device_data import DeviceDataResponse, DeviceDataRequest
from helpers.config import logger
from helpers.weather_client import fetch_current_weather, search_cities, fetch_forecast

router = APIRouter(prefix="/monitoring", tags=["monitoring"])
monitoring_service = MonitoringService()


@router.get("/data", response_model=List[DeviceDataResponse])
async def get_all_data(limit: int = Query(default=100, ge=1, le=1000)):
    """Get all device monitoring data"""
    data = monitoring_service.get_all_device_data(limit=limit)
    return data


@router.get("/data/{device_id}", response_model=List[DeviceDataResponse])
async def get_device_data(
    device_id: str, limit: int = Query(default=100, ge=1, le=1000)
):
    """Get monitoring data for a specific device"""
    data = monitoring_service.get_device_data(device_id, limit=limit)
    if not data:
        raise HTTPException(status_code=404, detail=f"No data found for device {device_id}")
    return data


@router.get("/data/{device_id}/latest", response_model=DeviceDataResponse)
async def get_latest_device_data(device_id: str):
    """Get latest monitoring data for a specific device"""
    data = monitoring_service.get_latest_device_data(device_id)
    if not data:
        raise HTTPException(
            status_code=404, detail=f"No data found for device {device_id}"
        )
    return data


@router.get("/data/{device_id}/range", response_model=List[DeviceDataResponse])
async def get_device_data_by_range(
    device_id: str,
    start_time: str = Query(..., description="Start time in ISO format"),
    end_time: str = Query(..., description="End time in ISO format"),
):
    """Get device data within a time range"""
    try:
        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use ISO format (e.g., 2025-01-28T10:00:00Z)"
        )

    data = monitoring_service.get_device_data_by_time_range(device_id, start, end)
    return data


@router.post("/data", response_model=dict, status_code=201)
async def add_device_data(data: DeviceDataRequest):
    """Manually add device data (usually data comes from RabbitMQ)"""
    data_dict = data.dict()
    if not data_dict.get("timestamp"):
        data_dict["timestamp"] = datetime.utcnow().isoformat()

    success = monitoring_service.save_device_data(data_dict)
    if success:
        return {"message": "Data saved successfully"}
    raise HTTPException(status_code=500, detail="Failed to save data")


@router.get("/weather/current", response_model=dict)
async def get_weather_current(
    lat: float = Query(default=48.8566, description="Latitude"),
    lon: float = Query(default=2.3522, description="Longitude"),
    city: str = Query(default="Paris", description="Nom de la ville"),
):
    """Météo actuelle via Open-Meteo (gratuit, sans clé API)."""
    result = fetch_current_weather(lat=lat, lon=lon, city=city)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Service météo temporairement indisponible.",
        )
    return result


@router.get("/weather/search-city", response_model=list[dict])
async def search_weather_city(
    q: str = Query(..., min_length=1, description="Nom (ou début de nom) de la ville"),
    count: int = Query(default=5, ge=1, le=10),
):
    """Recherche de villes via l'API de géocodage Open-Meteo (autocomplete)."""
    suggestions = search_cities(q, count=count)
    if suggestions is None:
        raise HTTPException(
            status_code=503,
            detail="Service de géocodage météo temporairement indisponible.",
        )
    return suggestions


@router.get("/weather/forecast", response_model=dict)
async def get_weather_forecast(
    lat: float = Query(default=48.8566, description="Latitude"),
    lon: float = Query(default=2.3522, description="Longitude"),
    city: str = Query(default="Paris", description="Nom de la ville"),
    days: int = Query(default=7, ge=1, le=7),
):
    """Prévisions 7 jours + horaires 24h + prédiction prochaine heure (Open-Meteo)."""
    result = fetch_forecast(lat=lat, lon=lon, city=city, days=days)
    if result is None:
        raise HTTPException(
            status_code=503,
            detail="Service de prévisions météo temporairement indisponible.",
        )
    return result


@router.get("/weather/analysis", response_model=dict)
async def get_weather_analysis(
    lat: float = Query(default=48.8566, description="Latitude"),
    lon: float = Query(default=2.3522, description="Longitude"),
    city: str = Query(default="Paris", description="Nom de la ville"),
    limit_data: int = Query(default=100, ge=10, le=500),
):
    """Analyse météo ↔ capteurs : anomalies (écart > seuil) et corrélation (écart moyen)."""
    weather_current = fetch_current_weather(lat=lat, lon=lon, city=city)
    if weather_current is None:
        raise HTTPException(
            status_code=503,
            detail="Service météo temporairement indisponible.",
        )
    all_data = monitoring_service.get_all_device_data(limit=limit_data)
    result = compute_weather_analysis(weather_current, all_data)
    return result


@router.get("/weather/prediction-24h", response_model=dict)
async def get_weather_prediction_24h(
    lat: float = Query(default=48.8566, description="Latitude"),
    lon: float = Query(default=2.3522, description="Longitude"),
    city: str = Query(default="Paris", description="Nom de la ville"),
    device_id: str = Query(..., description="Device ID pour entraîner notre modèle sur les capteurs"),
    blend_factor: float = Query(default=0.5, ge=0.0, le=1.0, description="Poids notre modèle (0=100% météo, 1=100% notre modèle)"),
    limit: int = Query(default=50, ge=5, le=200),
):
    """Prédiction 24h par notre modèle (entraîné sur les capteurs) + blend avec la météo Open-Meteo. Avancé : on n'utilise pas seulement l'API, on entraîne un modèle sur vos données IoT et on le combine avec la prévision."""
    forecast = fetch_forecast(lat=lat, lon=lon, city=city, days=2)
    if forecast is None or not forecast.get("hourly_24"):
        raise HTTPException(
            status_code=503,
            detail="Service de prévisions météo temporairement indisponible.",
        )
    sensor_data = monitoring_service.get_device_data(device_id, limit=limit)
    if not sensor_data or len(sensor_data) < 2:
        raise HTTPException(
            status_code=404,
            detail=f"Pas assez de données capteur pour {device_id} (minimum 2 points).",
        )
    points = list(reversed(sensor_data))
    weather_hourly_24 = forecast["hourly_24"]
    result = predict_24h_blended(points, weather_hourly_24, blend_factor=blend_factor)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Impossible de calculer la prédiction 24h (données insuffisantes).",
        )
    result["city"] = city
    result["device_id"] = device_id
    return result


@router.get("/data/{device_id}/predict", response_model=dict)
async def get_device_prediction(
    device_id: str,
    horizon_seconds: float = Query(default=60.0, ge=1.0, le=3600.0),
    limit: int = Query(default=30, ge=2, le=100),
):
    """Prédiction de température pour le prochain pas (ML: régression linéaire sur les N dernières mesures)."""
    data = monitoring_service.get_device_data(device_id, limit=limit)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for device {device_id}",
        )
    # Données triées par timestamp décroissant; on inverse pour ordre chronologique
    points = list(reversed(data))
    result = predict_temperature(points, next_seconds=horizon_seconds)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Not enough data points with temperature for prediction.",
        )
    result["device_id"] = device_id
    return result


@router.get("/data/{device_id}/predict-weather-aware", response_model=dict)
async def get_device_prediction_weather_aware(
    device_id: str,
    lat: float = Query(default=48.8566, description="Latitude (ville)"),
    lon: float = Query(default=2.3522, description="Longitude (ville)"),
    city: str = Query(default="Paris", description="Nom de la ville"),
    horizon_seconds: float = Query(default=3600.0, ge=60.0, le=86400.0),
    limit: int = Query(default=30, ge=2, le=100),
    blend_factor: float = Query(default=0.6, ge=0.0, le=1.0, description="Poids prédiction device (1=100% device, 0=100% météo)"),
):
    """Prédiction weather-aware : combine prédiction device (ML) + prévision météo (prochaine heure). La prédiction device est bornée autour de la météo (±15 °C) pour éviter des valeurs irréalistes (ex. 109 °C)."""
    forecast = fetch_forecast(lat=lat, lon=lon, city=city, days=1)
    weather_next_hour = None
    if forecast and forecast.get("next_hour"):
        weather_next_hour = forecast["next_hour"].get("temperature")

    data = monitoring_service.get_device_data(device_id, limit=limit)
    if not data:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for device {device_id}",
        )
    points = list(reversed(data))
    # Ancrage météo : la prédiction device est bornée à [météo - 15, météo + 15] °C pour éviter 109 °C
    device_pred_result = predict_temperature(
        points,
        next_seconds=horizon_seconds,
        weather_anchor=float(weather_next_hour) if weather_next_hour is not None else None,
        anchor_margin=15.0,
    )
    if device_pred_result is None:
        raise HTTPException(
            status_code=400,
            detail="Not enough data points with temperature for prediction.",
        )
    device_pred_temp = device_pred_result.get("predicted_temperature")
    was_clipped = device_pred_result.get("was_clipped", False)
    raw_prediction = device_pred_result.get("raw_prediction")

    # Quand la prédiction device est très éloignée de la météo (anomalie), réduire son poids
    # pour éviter des résultats "anormaux" (ex. 81 °C device vs 4 °C météo → blend trop élevé).
    ANOMALY_BLEND_THRESHOLD = 15.0  # °C : si |device - météo| > 15, on donne plus de poids à la météo
    effective_blend = blend_factor
    if weather_next_hour is not None and device_pred_temp is not None:
        dev_float = float(device_pred_temp)
        weather_float = float(weather_next_hour)
        if abs(dev_float - weather_float) > ANOMALY_BLEND_THRESHOLD:
            effective_blend = 0.25  # 25 % device, 75 % météo quand anomalie
        weather_aware_temp = round(
            effective_blend * dev_float + (1.0 - effective_blend) * weather_float,
            2,
        )
    else:
        weather_aware_temp = device_pred_temp
        weather_next_hour = None

    return {
        "device_id": device_id,
        "city": city,
        "device_prediction": device_pred_temp,
        "weather_next_hour": weather_next_hour,
        "weather_aware_prediction": weather_aware_temp,
        "blend_factor": effective_blend,
        "horizon_seconds": horizon_seconds,
        "anomaly_corrected": effective_blend != blend_factor,
        "prediction_bounded_by_weather": was_clipped,
        "raw_prediction_before_bound": raw_prediction,
    }
