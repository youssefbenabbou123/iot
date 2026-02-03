"""Analyse météo ↔ capteurs : anomalies et corrélation (écart moyen)."""
from typing import Any, Dict, List, Optional
from collections import defaultdict

ANOMALY_THRESHOLD_CELSIUS = 5.0  # écart > 5 °C → anomalie
MAX_READINGS_PER_DEVICE = 15


def compute_weather_analysis(
    weather_current: Optional[Dict[str, Any]],
    all_device_data: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Compare la météo actuelle aux mesures des capteurs.
    Retourne { city, weather_temp, weather_humidity, devices: [ { device_id, avg_temp, deviation, is_anomaly, mean_abs_error, sample_count } ] }.
    """
    if not weather_current:
        return {
            "city": None,
            "weather_temp": None,
            "weather_humidity": None,
            "devices": [],
        }
    weather_temp = weather_current.get("temperature")
    if weather_temp is None:
        weather_temp = 0.0
    else:
        weather_temp = float(weather_temp)

    # Grouper par device_id, garder les N dernières mesures avec température
    by_device: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for doc in all_device_data:
        did = doc.get("device_id")
        if not did:
            continue
        t = doc.get("temperature")
        if t is None:
            continue
        try:
            by_device[did].append({"temperature": float(t), "timestamp": doc.get("timestamp")})
        except (TypeError, ValueError):
            continue

    devices_result: List[Dict[str, Any]] = []
    for device_id, readings in by_device.items():
        # Dernières N lectures (déjà souvent triées par date décroissante)
        recent = readings[:MAX_READINGS_PER_DEVICE]
        temps = [r["temperature"] for r in recent]
        if not temps:
            continue
        avg_temp = sum(temps) / len(temps)
        deviation = avg_temp - weather_temp
        mean_abs_error = sum(abs(t - weather_temp) for t in temps) / len(temps)
        is_anomaly = abs(deviation) > ANOMALY_THRESHOLD_CELSIUS

        devices_result.append({
            "device_id": device_id,
            "avg_temp": round(avg_temp, 2),
            "deviation": round(deviation, 2),
            "is_anomaly": is_anomaly,
            "mean_abs_error": round(mean_abs_error, 2),
            "sample_count": len(temps),
        })

    # Trier par device_id pour affichage stable
    devices_result.sort(key=lambda x: x["device_id"])

    return {
        "city": weather_current.get("city"),
        "weather_temp": round(weather_temp, 2),
        "weather_humidity": weather_current.get("humidity"),
        "devices": devices_result,
        "anomaly_threshold_celsius": ANOMALY_THRESHOLD_CELSIUS,
    }
