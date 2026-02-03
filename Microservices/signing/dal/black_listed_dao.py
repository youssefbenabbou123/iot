from entities.user import BlacklistToken
from sqlalchemy.orm import Session
from helpers.redis_client import redis_is_blacklisted, redis_add_blacklist


def is_blacklist_token(session: Session, token: str) -> bool:
    """Vérifie si le token est blacklisté. Redis en priorité, fallback PostgreSQL."""
    # 1. Redis d'abord (rapide) - si trouvé, c'est blacklisté
    redis_result = redis_is_blacklisted(token)
    if redis_result is True:
        return True
    # 2. Redis down ou pas dans Redis -> vérifier PostgreSQL
    filtred_token = (
        session.query(BlacklistToken)
        .filter(BlacklistToken.token == token)
        .one_or_none()
    )
    return filtred_token is not None


def add_token_to_blacklist(session: Session, token: str) -> bool:
    """Ajoute le token à la blacklist. PostgreSQL toujours, Redis en plus si dispo."""
    blacklisted_token = BlacklistToken(token=token)
    session.add(blacklisted_token)
    try:
        session.commit()
        redis_add_blacklist(token)  # best-effort, pas d'erreur si Redis down
        return True
    except Exception:
        session.rollback()
        return False

