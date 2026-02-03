import uvicorn
from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import REGISTRY, generate_latest, CONTENT_TYPE_LATEST

from controllers.auth_controller import router
from helpers.config import Base, engine, LocalSession
from dal.user_dao import create_user, get_user_by_email
from entities.user import User

app = FastAPI(
    title="Authentication app",
    description="Micro service signing app (2025 version)",
    openapi_url="/openapi-signing.json",
)

# create tables one time
Base.metadata.create_all(bind=engine)
app.include_router(router)


@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics (observabilité – ne modifie pas la logique métier)."""
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)

# Utilisateur par défaut : créé ou mot de passe réinitialisé à chaque démarrage
DEFAULT_EMAIL = "gateway.user@example.com"
DEFAULT_PASSWORD = "password123"


@app.on_event("startup")
def seed_default_user():
    session = LocalSession()
    try:
        existing = get_user_by_email(session, DEFAULT_EMAIL)
        if existing:
            existing.password = DEFAULT_PASSWORD
            session.commit()
            print(f"[Signing] Mot de passe par défaut réinitialisé pour : {DEFAULT_EMAIL}")
        else:
            default_user = User(email=DEFAULT_EMAIL, password=DEFAULT_PASSWORD)
            if create_user(session, default_user):
                print(f"[Signing] Utilisateur par défaut créé : {DEFAULT_EMAIL}")
    except Exception as e:
        print(f"[Signing] Seed utilisateur : {e}")
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", reload=True)

