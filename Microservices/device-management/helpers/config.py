from typing import Final
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import logging

# environment variables (can be overridden in Docker / k8s)
USER_DB: Final[str] = os.getenv("USER_DB", "admin")
PASSWORD_DB: Final[str] = os.getenv("PASSWORD_DB", "1234")
NAME_DB: Final[str] = os.getenv("NAME_DB", "db_devices")
SERVER_DB: Final[str] = os.getenv("SERVER_DB", "localhost")
URL_DB: Final[str] = (
    "postgresql+psycopg2://"
    + USER_DB
    + ":"
    + PASSWORD_DB
    + "@"
    + SERVER_DB
    + ":5432/"
    + NAME_DB
)

# RabbitMQ configuration
RABBITMQ_HOST: Final[str] = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT: Final[int] = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER: Final[str] = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD: Final[str] = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE: Final[str] = os.getenv("RABBITMQ_EXCHANGE", "device_events")
RABBITMQ_QUEUE: Final[str] = os.getenv("RABBITMQ_QUEUE", "monitoring_queue")

# Signing service URL for JWT verification
SIGNING_SERVICE_URL: Final[str] = os.getenv("SIGNING_SERVICE_URL", "http://localhost:8000")

# SQLAlchemy
engine = create_engine(URL_DB, pool_size=10)
LocalSession = sessionmaker(bind=engine)
Base = declarative_base()


def session_factory():
    session = LocalSession()
    try:
        yield session
    finally:
        session.close()


# logs
os.makedirs("./logs", exist_ok=True)
formatter = logging.Formatter(fmt="%(asctime)s-%(levelname)s-%(message)s")
handler = logging.FileHandler("./logs/device_management.log")
handler.setFormatter(formatter)
logger = logging.getLogger("device_management")
logger.setLevel(logging.INFO)
if not logger.handlers:
    logger.addHandler(handler)
