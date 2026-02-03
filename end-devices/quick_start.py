"""
Script de démarrage rapide pour un end-device HTTP.

Exemple d'utilisation :
    python quick_start.py end_device_001
    python quick_start.py end_device_002 "Salle Serveurs"
"""

from end_device_client import EndDeviceClient, EndDeviceConfig


def main() -> None:
    import sys

    device_id = sys.argv[1] if len(sys.argv) > 1 else "end_device_001"
    location = sys.argv[2] if len(sys.argv) > 2 else "Office"

    cfg = EndDeviceConfig(
        device_id=device_id,
        name=f"End Device {device_id}",
        device_type="end_device",
        location=location,
    )
    client = EndDeviceClient(cfg)
    client.run_forever()


if __name__ == "__main__":
    main()

