import pika
import json
from typing import Dict, Any
from helpers.config import (
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_EXCHANGE,
    logger,
)


class RabbitMQPublisher:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.exchange = RABBITMQ_EXCHANGE

    def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            # Declare exchange (topic exchange for flexibility)
            self.channel.exchange_declare(
                exchange=self.exchange, exchange_type="topic", durable=True
            )
            logger.info(f"Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise

    def publish_device_event(self, event_type: str, device_data: Dict[str, Any]):
        """
        Publish device event to RabbitMQ
        event_type: e.g., 'device.created', 'device.updated', 'device.data'
        device_data: Dictionary containing device information
        """
        try:
            if not self.connection or self.connection.is_closed:
                self.connect()

            message = {
                "event_type": f"device.{event_type}",  # Format: "device.data", "device.created", etc.
                "timestamp": device_data.get("timestamp"),
                "device_id": device_data.get("device_id"),
                "data": device_data,
            }

            routing_key = f"device.{event_type}"
            self.channel.basic_publish(
                exchange=self.exchange,
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                ),
            )
            logger.info(f"Published event '{event_type}' for device {device_data.get('device_id')}")
        except Exception as e:
            logger.error(f"Failed to publish event to RabbitMQ: {e}")
            # Reconnect and retry once
            try:
                self.connect()
                self.channel.basic_publish(
                    exchange=self.exchange,
                    routing_key=f"device.{event_type}",
                    body=json.dumps(message),
                    properties=pika.BasicProperties(delivery_mode=2),
                )
            except Exception as retry_error:
                logger.error(f"Retry failed: {retry_error}")

    def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            logger.info("RabbitMQ connection closed")


# Global publisher instance
rabbitmq_publisher = RabbitMQPublisher()
