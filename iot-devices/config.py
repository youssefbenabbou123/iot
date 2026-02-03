"""
Configuration pour les simulateurs IoT
"""
import os
from typing import Final

# RabbitMQ Configuration
RABBITMQ_HOST: Final[str] = os.getenv("RABBITMQ_HOST", "localhost")
RABBITMQ_PORT: Final[int] = int(os.getenv("RABBITMQ_PORT", "56720"))
RABBITMQ_USER: Final[str] = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD: Final[str] = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE: Final[str] = os.getenv("RABBITMQ_EXCHANGE", "device_events")

# Device Configuration
DEFAULT_INTERVAL: Final[int] = int(os.getenv("SEND_INTERVAL", "5"))  # secondes
