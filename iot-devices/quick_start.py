"""
Script de démarrage rapide pour tester les simulateurs IoT
Lance un seul capteur de température pour tester rapidement
"""
import sys
from sensor_simulator import TemperatureSensor

if __name__ == "__main__":
    device_id = sys.argv[1] if len(sys.argv) > 1 else "device_001"
    interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5

    print("=" * 60)
    print("🚀 Simulateur IoT - Monitoring Cloud IoT 2025")
    print("=" * 60)
    print(f"Device ID: {device_id}")
    print(f"Type: Capteur de température")
    print(f"Intervalle: {interval} secondes")
    print("=" * 60)
    print("Appuyez sur Ctrl+C pour arrêter\n")

    sensor = TemperatureSensor(device_id)
    sensor.run(interval=interval)
