"""
Script pour lancer plusieurs simulateurs de capteurs en parallèle
Utile pour tester avec plusieurs devices simultanément
"""
import threading
import time
from sensor_simulator import TemperatureSensor, HumiditySensor, MultiSensor


def run_sensor(sensor, interval=5, duration=None):
    """Lancer un capteur dans un thread séparé"""
    sensor.run(interval=interval, duration=duration)


if __name__ == "__main__":
    # Configuration des capteurs à simuler
    sensors_config = [
        {"device_id": "device_001", "type": "temperature", "interval": 5},
        {"device_id": "device_002", "type": "humidity", "interval": 7},
        {"device_id": "device_003", "type": "multi", "interval": 5},
        {"device_id": "device_004", "type": "temperature", "interval": 10},
    ]

    threads = []

    print(f"[INFO] Démarrage de {len(sensors_config)} simulateurs...")
    print("[INFO] Appuyez sur Ctrl+C pour arrêter tous les simulateurs\n")

    try:
        for config in sensors_config:
            device_id = config["device_id"]
            sensor_type = config["type"]
            interval = config["interval"]

            if sensor_type == "temperature":
                sensor = TemperatureSensor(device_id)
            elif sensor_type == "humidity":
                sensor = HumiditySensor(device_id)
            elif sensor_type == "multi":
                sensor = MultiSensor(device_id)
            else:
                print(f"[WARNING] Type inconnu: {sensor_type}, ignoré")
                continue

            thread = threading.Thread(
                target=run_sensor,
                args=(sensor, interval),
                daemon=True,
            )
            thread.start()
            threads.append(thread)
            time.sleep(1)  # Délai entre les démarrages

        # Attendre que tous les threads se terminent
        for thread in threads:
            thread.join()

    except KeyboardInterrupt:
        print("\n[STOP] Arrêt de tous les simulateurs...")
