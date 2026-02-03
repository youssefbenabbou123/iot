import uvicorn
from fastapi import FastAPI
from fastapi.responses import Response
import socketio
from prometheus_client import REGISTRY, generate_latest, CONTENT_TYPE_LATEST

from controllers.monitoring_controller import router
from helpers.rabbitmq_consumer import start_rabbitmq_consumer
import asyncio
import threading

app = FastAPI(
    title="Monitoring app",
    description="Micro service monitoring app (2025 version)",
    openapi_url="/openapi-monitoring.json",
)

# Socket.IO setup
sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")
socket_app = socketio.ASGIApp(sio, app)

# Store socket manager globally for RabbitMQ consumer
from helpers.socket_manager import set_socket_manager, set_event_loop
set_socket_manager(sio)

# Include router
app.include_router(router)


@app.get("/metrics")
def metrics():
    """Expose Prometheus metrics (observabilité – ne modifie pas la logique métier)."""
    return Response(content=generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)


# Start RabbitMQ consumer in background thread
@app.on_event("startup")
async def startup_event():
    """Start RabbitMQ consumer when app starts"""
    set_event_loop(asyncio.get_running_loop())
    consumer_thread = threading.Thread(target=start_rabbitmq_consumer, daemon=True)
    consumer_thread.start()
    print("[OK] RabbitMQ consumer started in background")


if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8002, reload=True)
