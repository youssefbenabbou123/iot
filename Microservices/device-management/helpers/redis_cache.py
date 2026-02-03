"""
Redis cache pour Device Management - cache optionnel pour devices.
Si Redis est down, on utilise directement la base. Aucune erreur.
"""
import json
import os
from typing import Any, Optional

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
CACHE_TTL = 30  # secondes

_redis_client = None
_redis_available = False


def _get_redis():
    global _redis_client, _redis_available
    if _redis_client is not None:
        return _redis_client if _redis_available else None
    try:
        import redis
        _redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
        _redis_client.ping()
        _redis_available = True
        return _redis_client
    except Exception:
        _redis_available = False
        return None


def cache_get(key: str) -> Optional[Any]:
    """Récupère une valeur du cache. Retourne None si absent ou Redis down."""
    r = _get_redis()
    if r is None:
        return None
    try:
        data = r.get(key)
        return json.loads(data) if data else None
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl: int = CACHE_TTL) -> bool:
    """Stocke une valeur en cache. Retourne False si Redis down (pas d'erreur)."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception:
        return False


def cache_delete(key: str) -> bool:
    """Supprime une clé du cache. Best-effort."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.delete(key)
        return True
    except Exception:
        return False


def cache_invalidate_devices():
    """Invalide le cache des devices (après add/update/delete)."""
    cache_delete("devices:all")


def cache_invalidate_device(device_id: str):
    """Invalide le cache d'un device spécifique."""
    cache_delete(f"device:{device_id}")
