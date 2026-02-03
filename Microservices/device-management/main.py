import uvicorn
from fastapi import FastAPI
from fastapi.responses import Response
from prometheus_client import REGISTRY, generate_latest, CONTENT_TYPE_LATEST

from controllers.device_controller import router
from helpers.config import Base, engine

app = FastAPI(
    title="Device Management app",
    description="Micro service device management app (2025 version)",
    openapi_url="/openapi-devices.json",
)

# create tables one time
Base.metadata.create_all(bind=engine)
app.include_router(router)


@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics (observabilité – ne modifie pas la logique métier)."""
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
