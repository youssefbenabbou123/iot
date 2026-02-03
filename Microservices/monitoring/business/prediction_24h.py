"""
Prédiction 24h par notre modèle (entraîné sur les capteurs) + blend avec la météo.
Avancé : on n'utilise pas seulement l'API météo, on entraîne un modèle sur les données
du capteur et on le combine avec la prévision Open-Meteo pour les 24 prochaines heures.
"""
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta

try:
    from sklearn.linear_model import LinearRegression
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

WEATHER_ANCHOR_MARGIN = 15.0


def predict_24h_blended(
    sensor_points: List[Dict[str, Any]],
    weather_hourly_24: List[Dict[str, Any]],
    blend_factor: float = 0.5,
) -> Optional[Dict[str, Any]]:
    """
    Prédit la température pour les 24 prochaines heures en combinant :
    1) Notre modèle ML (régression linéaire sur les dernières mesures du capteur)
    2) La prévision météo Open-Meteo (heure par heure)
    Pour chaque heure : blended = blend_factor * our_model + (1 - blend_factor) * weather.
    La prédiction "our_model" est bornée autour de la météo (±15 °C) pour rester réaliste.

    sensor_points: liste de docs avec "timestamp" et "temperature", triés par timestamp croissant.
    weather_hourly_24: liste de 24 dicts avec "time" (ISO) et "temperature".
    blend_factor: poids de notre modèle (0 = 100% météo, 1 = 100% notre modèle).

    Retourne { hourly: [ { time, our_model_temp, weather_temp, blended_temp } ], method } ou None.
    """
    if not sensor_points or len(sensor_points) < 2:
        return None
    if not weather_hourly_24 or len(weather_hourly_24) < 24:
        return None
    if not HAS_SKLEARN:
        return _fallback_24h(sensor_points, weather_hourly_24, blend_factor)

    temps_ts = []
    values = []
    for p in sensor_points:
        t = p.get("timestamp")
        v = p.get("temperature")
        if t is not None and v is not None:
            try:
                ts = datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()
                temps_ts.append(ts)
                values.append(float(v))
            except (ValueError, TypeError):
                pass
    if len(temps_ts) < 2:
        return None

    X = np.array(temps_ts).reshape(-1, 1)
    y = np.array(values)
    model = LinearRegression()
    model.fit(X, y)

    last_ts = temps_ts[-1]
    hourly: List[Dict[str, Any]] = []
    for i, wh in enumerate(weather_hourly_24[:24]):
        w_time = wh.get("time")
        w_temp = wh.get("temperature")
        if w_time is None:
            continue
        try:
            # Timestamp de cette heure (prochaine heure = last_ts + 3600, etc.)
            next_ts = last_ts + (i + 1) * 3600.0
            our_pred = float(model.predict([[next_ts]])[0])
            weather_temp = float(w_temp) if w_temp is not None else our_pred
            # Borne notre prédiction autour de la météo (±15 °C)
            low = weather_temp - WEATHER_ANCHOR_MARGIN
            high = weather_temp + WEATHER_ANCHOR_MARGIN
            our_clipped = max(low, min(high, our_pred))
            blended = round(
                blend_factor * our_clipped + (1.0 - blend_factor) * weather_temp,
                2,
            )
            hourly.append({
                "time": w_time,
                "our_model_temp": round(our_clipped, 2),
                "weather_temp": round(weather_temp, 2) if w_temp is not None else None,
                "blended_temp": blended,
            })
        except (ValueError, TypeError):
            continue

    if len(hourly) < 24:
        return None
    return {
        "hourly": hourly,
        "method": "linear_regression_blended",
        "blend_factor": blend_factor,
        "based_on_n_points": len(values),
    }


def _fallback_24h(
    sensor_points: List[Dict[str, Any]],
    weather_hourly_24: List[Dict[str, Any]],
    blend_factor: float,
) -> Optional[Dict[str, Any]]:
    """Sans sklearn : moyenne des capteurs blendée avec la météo."""
    temps = [float(p["temperature"]) for p in sensor_points if p.get("temperature") is not None]
    if not temps:
        return None
    avg_sensor = sum(temps) / len(temps)
    hourly: List[Dict[str, Any]] = []
    for i, wh in enumerate(weather_hourly_24[:24]):
        w_time = wh.get("time")
        w_temp = wh.get("temperature")
        if w_time is None:
            continue
        weather_temp = float(w_temp) if w_temp is not None else avg_sensor
        low = weather_temp - WEATHER_ANCHOR_MARGIN
        high = weather_temp + WEATHER_ANCHOR_MARGIN
        our_clipped = max(low, min(high, avg_sensor))
        blended = round(
            blend_factor * our_clipped + (1.0 - blend_factor) * weather_temp,
            2,
        )
        hourly.append({
            "time": w_time,
            "our_model_temp": round(our_clipped, 2),
            "weather_temp": round(weather_temp, 2) if w_temp is not None else None,
            "blended_temp": blended,
        })
    return {
        "hourly": hourly,
        "method": "average_blended",
        "blend_factor": blend_factor,
        "based_on_n_points": len(temps),
    }
