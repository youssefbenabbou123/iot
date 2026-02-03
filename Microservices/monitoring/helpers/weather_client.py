"""Client Open-Meteo pour la météo (sans clé API)."""
import os
from typing import Any, Dict, Optional, List
from datetime import datetime, timezone
import httpx
from helpers.config import logger

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
DEFAULT_LAT = float(os.getenv("WEATHER_LAT", "48.8566"))
DEFAULT_LON = float(os.getenv("WEATHER_LON", "2.3522"))
DEFAULT_CITY = os.getenv("WEATHER_CITY", "Paris")


def _weather_code_to_description(code: int) -> str:
    """Convertit le code météo WMO en description."""
    codes = {
        0: "Ciel dégagé",
        1: "Principalement dégagé",
        2: "Partiellement nuageux",
        3: "Nuageux",
        45: "Brouillard",
        48: "Brouillard givrant",
        51: "Bruine légère",
        61: "Pluie légère",
        71: "Neige légère",
        80: "Averses de pluie",
        95: "Orage",
    }
    return codes.get(code, f"Code {code}")


def fetch_current_weather(
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON,
    city: str = DEFAULT_CITY,
) -> Optional[Dict[str, Any]]:
    """
    Récupère la météo actuelle via Open-Meteo (gratuit, sans clé).
    Retourne { temperature, humidity, description, city, updated_at,
               pressure, wind_speed, wind_direction, precipitation } ou None.
    """
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,precipitation",
                },
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"[WEATHER] Open-Meteo fetch failed: {e}")
        return None

    current = data.get("current") or {}
    temp = current.get("temperature_2m")
    humidity = current.get("relative_humidity_2m")
    code = current.get("weather_code", 0)
    pressure = current.get("surface_pressure")
    wind_speed = current.get("wind_speed_10m")
    wind_direction = current.get("wind_direction_10m")
    precipitation = current.get("precipitation")

    return {
        "temperature": float(temp) if temp is not None else None,
        "humidity": float(humidity) if humidity is not None else None,
        "description": _weather_code_to_description(int(code)),
        "city": city,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "pressure": float(pressure) if pressure is not None else None,
        "wind_speed": float(wind_speed) if wind_speed is not None else None,
        "wind_direction": int(wind_direction) if wind_direction is not None else None,
        "precipitation": float(precipitation) if precipitation is not None else None,
    }


def search_cities(query: str, count: int = 5) -> Optional[List[Dict[str, Any]]]:
    """
    Utilise l'API de géocodage Open-Meteo pour suggérer des villes dans le monde entier.
    Retourne une liste de lieux { name, country, latitude, longitude } ou None en cas d'erreur.
    """
    if not query.strip():
        return []
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(
                OPEN_METEO_GEOCODING_URL,
                params={
                    "name": query,
                    "count": count,
                    "language": "fr",
                    "format": "json",
                },
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"[WEATHER] Open-Meteo geocoding failed: {e}")
        return None

    results = data.get("results") or []
    suggestions: List[Dict[str, Any]] = []
    for item in results:
        suggestions.append(
            {
                "name": item.get("name"),
                "country": item.get("country"),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
            }
        )
    return suggestions


def fetch_forecast(
    lat: float = DEFAULT_LAT,
    lon: float = DEFAULT_LON,
    city: str = DEFAULT_CITY,
    days: int = 7,
) -> Optional[Dict[str, Any]]:
    """
    Récupère les prévisions sur 7 jours + données horaires (pour prédiction 1h).
    Retourne { city, daily[], hourly_24[], next_hour } ou None.
    """
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(
                OPEN_METEO_URL,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum,wind_speed_10m_max",
                    "hourly": "temperature_2m,weather_code,precipitation",
                    "forecast_days": min(max(days, 1), 7),
                },
            )
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"[WEATHER] Open-Meteo forecast failed: {e}")
        return None

    daily_times = data.get("daily", {}).get("time") or []
    daily_max = data.get("daily", {}).get("temperature_2m_max") or []
    daily_min = data.get("daily", {}).get("temperature_2m_min") or []
    daily_codes = data.get("daily", {}).get("weather_code") or []
    daily_precip = data.get("daily", {}).get("precipitation_sum") or []
    daily_wind = data.get("daily", {}).get("wind_speed_10m_max") or []

    daily: List[Dict[str, Any]] = []
    for i, t in enumerate(daily_times):
        daily.append({
            "date": t,
            "temp_min": float(daily_min[i]) if i < len(daily_min) else None,
            "temp_max": float(daily_max[i]) if i < len(daily_max) else None,
            "description": _weather_code_to_description(int(daily_codes[i]) if i < len(daily_codes) else 0),
            "precipitation_sum": float(daily_precip[i]) if i < len(daily_precip) else None,
            "wind_speed_max": float(daily_wind[i]) if i < len(daily_wind) else None,
        })

    hourly_times = data.get("hourly", {}).get("time") or []
    hourly_temps = data.get("hourly", {}).get("temperature_2m") or []
    hourly_codes = data.get("hourly", {}).get("weather_code") or []
    hourly_precip = data.get("hourly", {}).get("precipitation") or []

    hourly_24: List[Dict[str, Any]] = []
    for i, t in enumerate(hourly_times[:24]):
        hourly_24.append({
            "time": t,
            "temperature": float(hourly_temps[i]) if i < len(hourly_temps) else None,
            "description": _weather_code_to_description(int(hourly_codes[i]) if i < len(hourly_codes) else 0),
            "precipitation": float(hourly_precip[i]) if i < len(hourly_precip) else None,
        })

    # Prévisions 48h (2 jours) pour horizon plus long que 1h
    hourly_48: List[Dict[str, Any]] = []
    for i, t in enumerate(hourly_times[:48]):
        hourly_48.append({
            "time": t,
            "temperature": float(hourly_temps[i]) if i < len(hourly_temps) else None,
            "description": _weather_code_to_description(int(hourly_codes[i]) if i < len(hourly_codes) else 0),
            "precipitation": float(hourly_precip[i]) if i < len(hourly_precip) else None,
        })

    # Prédiction "prochaine heure" = première heure future (index 1)
    next_hour: Optional[Dict[str, Any]] = None
    if len(hourly_times) >= 2 and len(hourly_temps) >= 2:
        next_hour = {
            "time": hourly_times[1],
            "temperature": float(hourly_temps[1]) if hourly_temps[1] is not None else None,
            "description": _weather_code_to_description(int(hourly_codes[1]) if len(hourly_codes) > 1 else 0),
        }

    return {
        "city": city,
        "daily": daily,
        "hourly_24": hourly_24,
        "hourly_48": hourly_48,
        "next_hour": next_hour,
    }
