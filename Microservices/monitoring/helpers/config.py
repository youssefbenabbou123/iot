from typing import Final
import os
from pymongo import MongoClient
import logging

# MongoDB configuration
MONGO_HOST: Final[str] = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT: Final[int] = int(os.getenv("MONGO_PORT", "27017"))
MONGO_DB: Final[str] = os.getenv("MONGO_DB", "monitoring_db")
MONGO_URI: Final[str] = os.getenv(
    "MONGO_URI", f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"
)

# RabbitMQ configuration
RABBITMQ_HOST: Final[str] = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT: Final[int] = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER: Final[str] = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD: Final[str] = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE: Final[str] = os.getenv("RABBITMQ_EXCHANGE", "device_events")
RABBITMQ_QUEUE: Final[str] = os.getenv("RABBITMQ_QUEUE", "monitoring_queue")

# MongoDB client
mongo_client = MongoClient(MONGO_URI)
db = mongo_client[MONGO_DB]
collection = db["device_data"]

# logs
os.makedirs("./logs", exist_ok=True)
formatter = logging.Formatter(fmt="%(asctime)s-%(levelname)s-%(message)s")
handler = logging.FileHandler("./logs/monitoring.log")
handler.setFormatter(formatter)
logger = logging.getLogger("monitoring")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(handler)
