import pika
import json
import time
import asyncio
from typing import Dict, Any
from helpers.config import (
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_EXCHANGE,
    RABBITMQ_QUEUE,
    logger,
    collection,
)
from helpers.socket_manager import get_socket_manager, get_event_loop


def connect_to_rabbitmq():
    """Establish connection to RabbitMQ with retry logic"""
    for attempt in range(5):
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300,
            )
            connection = pika.BlockingConnection(parameters)
            channel = connection.channel()
            # Declare exchange and queue
            channel.exchange_declare(
                exchange=RABBITMQ_EXCHANGE, exchange_type="topic", durable=True
            )
            channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
            # Bind queue to exchange with routing key pattern
            channel.queue_bind(
                exchange=RABBITMQ_EXCHANGE,
                queue=RABBITMQ_QUEUE,
                routing_key="device.*",  # Listen to all device events
            )
            logger.info(f"[OK] Connected to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
            return connection, channel
        except Exception as e:
            logger.warning(
                f"[WARNING] RabbitMQ connection attempt {attempt + 1}/5 failed: {e}"
            )
            if attempt < 4:
                time.sleep(5)
            else:
                logger.error("[ERROR] Failed to connect to RabbitMQ after 5 attempts")
                raise


def process_message(ch, method, properties, body):
    """Process incoming RabbitMQ message"""
    try:
        message = json.loads(body)
        event_type = message.get("event_type", "unknown")
        device_data = message.get("data", {})

        # Only process 'device.data' events for monitoring
        if event_type == "device.data":
            # Store in MongoDB (température, humidité, CPU/RAM/disk des end-devices, etc.)
            document = {
                "device_id": device_data.get("device_id"),
                "temperature": device_data.get("temperature"),
                "humidity": device_data.get("humidity"),
                "status": device_data.get("status"),
                "timestamp": device_data.get("timestamp"),
                "event_type": event_type,
            }
            if device_data.get("cpu") is not None:
                document["cpu"] = device_data.get("cpu")
            if device_data.get("memory_percent") is not None:
                document["memory_percent"] = device_data.get("memory_percent")
            if device_data.get("disk_percent") is not None:
                document["disk_percent"] = device_data.get("disk_percent")
            collection.insert_one(document)
            logger.info(
                f"[DATA] Stored data for device {device_data.get('device_id')} in MongoDB"
            )

            # Socket.IO real-time broadcast (depuis le thread RabbitMQ → boucle asyncio principale)
            try:
                sio = get_socket_manager()
                loop = get_event_loop()
                if sio is not None and loop is not None:
                    async def emit_data():
                        await sio.emit("device_data", document)
                    asyncio.run_coroutine_threadsafe(emit_data(), loop)
                    logger.info(
                        f"[SOCKET] Emitted device_data for {document.get('device_id')}"
                    )
                else:
                    logger.warning("[SOCKET] Socket manager or event loop not initialized")
            except Exception as socket_error:
                logger.error(f"[SOCKET] Error emitting via Socket.IO: {socket_error}")

        # Acknowledge message
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except json.JSONDecodeError as e:
        logger.error(f"[ERROR] Failed to parse RabbitMQ message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    except Exception as e:
        logger.error(f"[ERROR] Error processing message: {e}")
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


def start_rabbitmq_consumer():
    """Start consuming messages from RabbitMQ"""
    try:
        connection, channel = connect_to_rabbitmq()
        channel.basic_qos(prefetch_count=1)  # Process one message at a time
        channel.basic_consume(
            queue=RABBITMQ_QUEUE, on_message_callback=process_message
        )
        logger.info(f"[CONSUMER] Started consuming from RabbitMQ queue: {RABBITMQ_QUEUE}")
        channel.start_consuming()
    except Exception as e:
        logger.error(f"[ERROR] RabbitMQ consumer error: {e}")
        # Retry after delay
        time.sleep(10)
        start_rabbitmq_consumer()
