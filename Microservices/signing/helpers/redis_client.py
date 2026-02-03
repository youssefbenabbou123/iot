"""
Redis client pour Signing - blacklist des tokens.
Fallback automatique : si Redis est indisponible, on utilise PostgreSQL.
Aucune erreur ne sera levée - le service continue de fonctionner.
"""
import hashlib
import os
from typing import Optional

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
BLACKLIST_PREFIX = "blacklist:"
TTL_SECONDS = 86400 * 7  # 7 jours

_redis_client = None
_redis_available = False


def _token_key(token: str) -> str:
    return f"{BLACKLIST_PREFIX}{hashlib.sha256(token.encode()).hexdigest()}"


def _get_redis():
    """Retourne le client Redis ou None si indisponible."""
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


def redis_add_blacklist(token: str) -> bool:
    """Ajoute un token à la blacklist Redis. Retourne True si OK, False si Redis down (pas d'erreur)."""
    r = _get_redis()
    if r is None:
        return False
    try:
        r.setex(_token_key(token), TTL_SECONDS, "1")
        return True
    except Exception:
        return False


def redis_is_blacklisted(token: str) -> Optional[bool]:
    """
    Vérifie si le token est blacklisté dans Redis.
    Retourne True si blacklisté, False si pas blacklisté, None si Redis indisponible.
    """
    r = _get_redis()
    if r is None:
        return None
    try:
        return r.exists(_token_key(token)) > 0
    except Exception:
        return None
