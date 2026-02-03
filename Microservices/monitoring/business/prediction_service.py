"""Prédiction de température par device (régression linéaire sur les N dernières mesures)."""
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timezone

try:
    from sklearn.linear_model import LinearRegression
    import numpy as np
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

# Plage réaliste pour une température ambiante (°C) : évite 109 °C ou -50 °C
GLOBAL_TEMP_MIN = -30.0
GLOBAL_TEMP_MAX = 70.0
# Marge autour de la météo quand on ancre la prédiction (écart max capteur ↔ météo réaliste)
WEATHER_ANCHOR_MARGIN = 15.0


def _clip_prediction(
    pred: float,
    weather_anchor: Optional[float] = None,
    anchor_margin: float = WEATHER_ANCHOR_MARGIN,
) -> Tuple[float, bool]:
    """
    Borne la prédiction à une plage réaliste.
    Si weather_anchor est fourni : [weather_anchor - margin, weather_anchor + margin].
    Sinon : [GLOBAL_TEMP_MIN, GLOBAL_TEMP_MAX].
    Retourne (température bornée, was_clipped).
    """
    if weather_anchor is not None:
        low = weather_anchor - anchor_margin
        high = weather_anchor + anchor_margin
    else:
        low = GLOBAL_TEMP_MIN
        high = GLOBAL_TEMP_MAX
    was_clipped = pred < low or pred > high
    clipped = max(low, min(high, pred))
    return round(clipped, 2), was_clipped


def predict_temperature(
    points: List[Dict[str, Any]],
    next_seconds: float = 60.0,
    weather_anchor: Optional[float] = None,
    anchor_margin: float = WEATHER_ANCHOR_MARGIN,
) -> Optional[Dict[str, Any]]:
    """
    Prédit la température au prochain pas de temps à partir des N dernières mesures.
    points: liste de docs avec "timestamp" et "temperature", triés par timestamp croissant.
    next_seconds: horizon de prédiction en secondes (défaut 60).
    weather_anchor: si fourni (ex. météo prochaine heure), la prédiction est bornée autour
        de cette valeur (± anchor_margin) pour éviter des extrapolations irréalistes (ex. 109 °C).
    anchor_margin: écart max autorisé autour de weather_anchor (défaut 15 °C).
    Retourne { "predicted_temperature", "based_on_n_points", "horizon_seconds", "was_clipped", "raw_prediction" } ou None.
    """
    if not points or len(points) < 2:
        return None
    temps = []
    values = []
    for p in points:
        t = p.get("timestamp")
        v = p.get("temperature")
        if t is not None and v is not None:
            try:
                ts = datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp()
                temps.append(ts)
                values.append(float(v))
            except (ValueError, TypeError):
                pass
    if len(temps) < 2:
        return None
    if not HAS_SKLEARN:
        avg = sum(values) / len(values)
        clipped, was_clipped = _clip_prediction(avg, weather_anchor, anchor_margin)
        out = {
            "predicted_temperature": clipped,
            "based_on_n_points": len(values),
            "horizon_seconds": next_seconds,
            "method": "average",
            "was_clipped": was_clipped,
        }
        if was_clipped:
            out["raw_prediction"] = round(avg, 2)
        return out
    X = np.array(temps).reshape(-1, 1)
    y = np.array(values)
    model = LinearRegression()
    model.fit(X, y)
    last_ts = temps[-1]
    next_ts = last_ts + next_seconds
    raw_pred = float(model.predict([[next_ts]])[0])
    clipped, was_clipped = _clip_prediction(raw_pred, weather_anchor, anchor_margin)
    out = {
        "predicted_temperature": clipped,
        "based_on_n_points": len(values),
        "horizon_seconds": next_seconds,
        "method": "linear_regression",
        "was_clipped": was_clipped,
    }
    if was_clipped:
        out["raw_prediction"] = round(raw_pred, 2)
    return out
