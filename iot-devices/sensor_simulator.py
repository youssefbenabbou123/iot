"""
Simulateur de capteur IoT générique
Publie des données sur RabbitMQ pour être consommées par le service Monitoring
"""
import pika
import json
import time
import random
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from config import (
    RABBITMQ_HOST,
    RABBITMQ_PORT,
    RABBITMQ_USER,
    RABBITMQ_PASSWORD,
    RABBITMQ_EXCHANGE,
)


class SensorSimulator:
    """Simulateur de capteur IoT générique"""

    def __init__(self, device_id: str, device_type: str = "sensor"):
        self.device_id = device_id
        self.device_type = device_type
        self.connection = None
        self.channel = None
        self.exchange = RABBITMQ_EXCHANGE

    def connect(self):
        """Établir la connexion à RabbitMQ"""
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            parameters = pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials,
            )
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            # Déclarer l'exchange (topic)
            self.channel.exchange_declare(
                exchange=self.exchange, exchange_type="topic", durable=True
            )
            print(f"[OK] Connecté à RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        except Exception as e:
            print(f"[ERROR] Échec de connexion à RabbitMQ: {e}")
            raise

    def publish_data(self, data: Dict[str, Any]):
        """
        Publier des données de capteur sur RabbitMQ
        Format attendu par le service Monitoring:
        {
            "event_type": "device.data",
            "timestamp": "2025-01-28T20:00:00",
            "device_id": "device_001",
            "data": {
                "device_id": "device_001",
                "temperature": 25.5,
                "status": "online",
                "timestamp": "2025-01-28T20:00:00"
            }
        }
        """
        try:
            if not self.connection or self.connection.is_closed:
                self.connect()

            # Utiliser une datetime UTC avec timezone explicite (recommandé)
            timestamp = datetime.now(timezone.utc).isoformat()

            message = {
                "event_type": "device.data",
                "timestamp": timestamp,
                "device_id": self.device_id,
                "data": {
                    "device_id": self.device_id,
                    "timestamp": timestamp,
                    **data,  # Ajouter les données spécifiques (temperature, humidity, etc.)
                },
            }

            routing_key = "device.data"
            self.channel.basic_publish(
                exchange=self.exchange,
                routing_key=routing_key,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Message persistant
                ),
            )
            print(f"[SENT] Device {self.device_id}: {json.dumps(data)}")
        except Exception as e:
            print(f"[ERROR] Échec de publication: {e}")
            # Réessayer une fois
            try:
                self.connect()
                timestamp = datetime.now(timezone.utc).isoformat()
                message = {
                    "event_type": "device.data",
                    "timestamp": timestamp,
                    "device_id": self.device_id,
                    "data": {
                        "device_id": self.device_id,
                        "timestamp": timestamp,
                        **data,
                    },
                }
                self.channel.basic_publish(
                    exchange=self.exchange,
                    routing_key="device.data",
                    body=json.dumps(message),
                    properties=pika.BasicProperties(delivery_mode=2),
                )
            except Exception as retry_error:
                print(f"[ERROR] Réessai échoué: {retry_error}")

    def close(self):
        """Fermer la connexion RabbitMQ"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
            print(f"[CLOSED] Connexion fermée pour {self.device_id}")


class TemperatureSensor(SensorSimulator):
    """Simulateur de capteur de température"""

    def __init__(self, device_id: str, base_temp: float = 20.0, variance: float = 5.0):
        super().__init__(device_id, "temperature_sensor")
        self.base_temp = base_temp
        self.variance = variance
        self.current_temp = base_temp

    def generate_reading(self) -> Dict[str, Any]:
        """Générer une lecture de température simulée"""
        # Simulation avec variation progressive
        change = random.uniform(-2.0, 2.0)
        self.current_temp += change
        # Maintenir dans une plage raisonnable
        self.current_temp = max(
            self.base_temp - self.variance,
            min(self.base_temp + self.variance, self.current_temp),
        )

        return {
            "temperature": round(self.current_temp, 2),
            "status": "online",
        }

    def run(self, interval: int = 5, duration: Optional[int] = None):
        """
        Exécuter le simulateur
        interval: Intervalle entre les envois (secondes)
        duration: Durée totale d'exécution (secondes), None = infini
        """
        self.connect()
        start_time = time.time()
        count = 0

        try:
            print(f"[START] Capteur température {self.device_id} démarré")
            while True:
                data = self.generate_reading()
                self.publish_data(data)
                count += 1

                if duration and (time.time() - start_time) >= duration:
                    break

                time.sleep(interval)
        except KeyboardInterrupt:
            print(f"\n[STOP] Arrêt demandé pour {self.device_id}")
        finally:
            self.close()
            print(f"[END] {self.device_id}: {count} messages envoyés")


class HumiditySensor(SensorSimulator):
    """Simulateur de capteur d'humidité"""

    def __init__(self, device_id: str, base_humidity: float = 50.0, variance: float = 10.0):
        super().__init__(device_id, "humidity_sensor")
        self.base_humidity = base_humidity
        self.variance = variance
        self.current_humidity = base_humidity

    def generate_reading(self) -> Dict[str, Any]:
        """Générer une lecture d'humidité simulée"""
        change = random.uniform(-3.0, 3.0)
        self.current_humidity += change
        # Maintenir entre 0 et 100%
        self.current_humidity = max(0, min(100, self.current_humidity))

        return {
            "humidity": round(self.current_humidity, 2),
            "status": "online",
        }

    def run(self, interval: int = 5, duration: Optional[int] = None):
        """Exécuter le simulateur"""
        self.connect()
        start_time = time.time()
        count = 0

        try:
            print(f"[START] Capteur humidité {self.device_id} démarré")
            while True:
                data = self.generate_reading()
                self.publish_data(data)
                count += 1

                if duration and (time.time() - start_time) >= duration:
                    break

                time.sleep(interval)
        except KeyboardInterrupt:
            print(f"\n[STOP] Arrêt demandé pour {self.device_id}")
        finally:
            self.close()
            print(f"[END] {self.device_id}: {count} messages envoyés")


class MultiSensor(SensorSimulator):
    """Simulateur multi-capteurs (température + humidité)"""

    def __init__(self, device_id: str):
        super().__init__(device_id, "multi_sensor")
        self.temp_sensor = TemperatureSensor(device_id)
        self.humidity_sensor = HumiditySensor(device_id)

    def generate_reading(self) -> Dict[str, Any]:
        """Générer une lecture combinée"""
        temp_data = self.temp_sensor.generate_reading()
        humidity_data = self.humidity_sensor.generate_reading()

        return {
            "temperature": temp_data["temperature"],
            "humidity": humidity_data["humidity"],
            "status": "online",
        }

    def run(self, interval: int = 5, duration: Optional[int] = None):
        """Exécuter le simulateur"""
        self.connect()
        start_time = time.time()
        count = 0

        try:
            print(f"[START] Multi-capteur {self.device_id} démarré")
            while True:
                data = self.generate_reading()
                self.publish_data(data)
                count += 1

                if duration and (time.time() - start_time) >= duration:
                    break

                time.sleep(interval)
        except KeyboardInterrupt:
            print(f"\n[STOP] Arrêt demandé pour {self.device_id}")
        finally:
            self.close()
            print(f"[END] {self.device_id}: {count} messages envoyés")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python sensor_simulator.py <device_id> [sensor_type] [interval]")
        print("Exemples:")
        print("  python sensor_simulator.py device_001 temperature 5")
        print("  python sensor_simulator.py device_002 humidity 10")
        print("  python sensor_simulator.py device_003 multi 5")
        sys.exit(1)

    device_id = sys.argv[1]
    sensor_type = sys.argv[2] if len(sys.argv) > 2 else "temperature"
    interval = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    if sensor_type == "temperature":
        sensor = TemperatureSensor(device_id)
    elif sensor_type == "humidity":
        sensor = HumiditySensor(device_id)
    elif sensor_type == "multi":
        sensor = MultiSensor(device_id)
    else:
        print(f"Type de capteur inconnu: {sensor_type}")
        sys.exit(1)

    sensor.run(interval=interval)
