"""
Client HTTP pour les end-devices.

Rôle :
- s'authentifier auprès du microservice Signing (via la gateway)
- enregistrer un device auprès de Device Management (si nécessaire)
- envoyer périodiquement des métriques (CPU, RAM, température fictive, etc.)
  vers l'endpoint /devices/{device_id}/data (HTTP, pas d'auth pour les devices)
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Optional, Dict, Any

import psutil
import requests

# Retry en cas de coupure transitoire (gateway / device-management redémarré)
MAX_METRICS_RETRIES = 5
RETRY_DELAY_SEC = 2

from config import (
    GATEWAY_BASE_URL,
    SIGNING_REGISTER_ENDPOINT,
    SIGNING_AUTH_ENDPOINT,
    DEVICES_BASE_ENDPOINT,
    CLIENT_EMAIL,
    CLIENT_PASSWORD,
    METRICS_INTERVAL,
)


@dataclass
class EndDeviceConfig:
    device_id: str
    name: str = "End Device"
    device_type: str = "end_device"
    location: str = "Unknown"


class EndDeviceClient:
    def __init__(self, config: EndDeviceConfig):
        self.config = config
        self.token: Optional[str] = None
        self.session = requests.Session()

    # ---------- AUTH ----------

    def register_client_user(self) -> None:
        """
        Enregistre l'utilisateur CLIENT_EMAIL s'il n'existe pas encore.
        """
        payload = {"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
        resp = self.session.post(
            SIGNING_REGISTER_ENDPOINT, json=payload, timeout=10
        )

        if resp.status_code in (200, 201):
            print(f"[AUTH] Utilisateur {CLIENT_EMAIL} enregistré")
            return

        # Si déjà existant (erreur 401 dans notre backend actuel), on ignore
        if resp.status_code == 401:
            print(f"[AUTH] Utilisateur {CLIENT_EMAIL} déjà existant (401)")
            return

        raise RuntimeError(
            f"Échec enregistrement utilisateur ({resp.status_code}): {resp.text}"
        )

    def authenticate(self) -> None:
        """
        Authentifie l'end-device via le service Signing
        et stocke le token JWT.
        """
        payload = {"email": CLIENT_EMAIL, "password": CLIENT_PASSWORD}
        resp = self.session.post(SIGNING_AUTH_ENDPOINT, json=payload, timeout=10)

        # Si l'auth échoue (401), on tente d'abord de créer l'utilisateur puis on réessaie
        if resp.status_code == 401:
            print(
                f"[AUTH] 401 lors de l'authentification, tentative d'enregistrement de {CLIENT_EMAIL}"
            )
            self.register_client_user()
            resp = self.session.post(
                SIGNING_AUTH_ENDPOINT, json=payload, timeout=10
            )

        if resp.status_code != 200:
            raise RuntimeError(
                f"Échec authentification ({resp.status_code}): {resp.text}"
            )
        data = resp.json()
        self.token = data.get("token")
        if not self.token:
            raise RuntimeError("Token manquant dans la réponse d'authentification")
        print(f"[AUTH] Token obtenu pour {CLIENT_EMAIL}")

    def _auth_headers(self) -> Dict[str, str]:
        if not self.token:
            raise RuntimeError("Token non initialisé, appelez authenticate() d'abord")
        return {"Authorization": f"Bearer {self.token}"}

    # ---------- DEVICE MGMT ----------

    def ensure_device_registered(self) -> None:
        """
        Vérifie si le device existe, sinon le crée via /devices (auth requis).
        """
        # 1) Vérifier existence
        url_get = f"{DEVICES_BASE_ENDPOINT}/{self.config.device_id}"
        resp = self.session.get(url_get, headers=self._auth_headers(), timeout=10)
        if resp.status_code == 200:
            print(f"[DEVICE] {self.config.device_id} déjà enregistré")
            return

        if resp.status_code not in (404, 422):
            raise RuntimeError(
                f"Erreur lors de la vérification du device ({resp.status_code}): {resp.text}"
            )

        # 2) Créer le device
        payload = {
            "device_id": self.config.device_id,
            "name": self.config.name,
            "device_type": self.config.device_type,
            "status": "online",
            "location": self.config.location,
            "temperature": 0.0,
        }
        resp = self.session.post(
            DEVICES_BASE_ENDPOINT,
            headers={**self._auth_headers(), "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        if resp.status_code == 201:
            print(f"[DEVICE] {self.config.device_id} créé avec succès")
            return

        # Si la création via la gateway échoue (ex: 404 Nginx), on journalise
        # mais on ne bloque pas l'exécution : l'endpoint /devices/{id}/data
        # peut encore fonctionner si le device existe déjà.
        print(
            f"[DEVICE][WARN] Échec création device via gateway "
            f"({resp.status_code}): {resp.text}"
        )

    # ---------- METRICS ----------

    @staticmethod
    def collect_metrics() -> Dict[str, Any]:
        """
        Collecte des métriques système de l'end-device.
        """
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        # Température fictive basée sur la charge CPU
        fake_temperature = 20.0 + (cpu / 100.0) * 30.0

        return {
            "cpu_percent": round(cpu, 2),
            "memory_percent": round(mem.percent, 2),
            "disk_percent": round(disk.percent, 2),
            "temperature": round(fake_temperature, 2),
            "status": "online",
        }

    def send_metrics_once(self) -> None:
        """
        Envoie une seule fois les métriques vers /devices/{device_id}/data
        (pas d'authentification requise pour cet endpoint côté backend).
        En cas de coupure de connexion (gateway/device-management indisponible),
        réessaie jusqu'à MAX_METRICS_RETRIES fois puis passe au cycle suivant.
        """
        metrics = self.collect_metrics()
        payload = {
            "device_id": self.config.device_id,
            **metrics,
        }
        url = f"{DEVICES_BASE_ENDPOINT}/{self.config.device_id}/data"
        last_error = None
        for attempt in range(1, MAX_METRICS_RETRIES + 1):
            try:
                resp = self.session.post(url, json=payload, timeout=10)
                if resp.status_code in (200, 201):
                    print(f"[METRICS] {self.config.device_id} -> {metrics}")
                    return
                last_error = RuntimeError(
                    f"Échec envoi métriques ({resp.status_code}): {resp.text}"
                )
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                last_error = e
            if attempt < MAX_METRICS_RETRIES:
                print(
                    f"[METRICS][WARN] Tentative {attempt}/{MAX_METRICS_RETRIES} échouée "
                    f"({last_error!r}), nouvelle tentative dans {RETRY_DELAY_SEC}s..."
                )
                time.sleep(RETRY_DELAY_SEC)
            else:
                print(
                    f"[METRICS][WARN] Envoi échoué après {MAX_METRICS_RETRIES} tentatives. "
                    f"Cycle suivant dans {METRICS_INTERVAL}s. Dernière erreur: {last_error!r}"
                )
                return

    def run_forever(self, interval: int = METRICS_INTERVAL) -> None:
        """
        Boucle principale : authentification, enregistrement du device,
        puis envoi périodique des métriques.
        """
        print("=" * 60)
        print("🚀 End-Device HTTP Client - Monitoring Cloud IoT 2025")
        print("=" * 60)
        print(f"Gateway (SIGNING) : {GATEWAY_BASE_URL}")
        print(f"Devices API       : {DEVICES_BASE_ENDPOINT}")
        print(f"Device ID         : {self.config.device_id}")
        print(f"Intervalle        : {interval} secondes")
        print("=" * 60)

        # Auth + register
        self.authenticate()
        self.ensure_device_registered()

        print("[RUN] Envoi périodique des métriques (Ctrl+C pour arrêter)")
        try:
            while True:
                self.send_metrics_once()
                time.sleep(interval)
        except KeyboardInterrupt:
            print("\n[STOP] End-device arrêté proprement")


if __name__ == "__main__":
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

