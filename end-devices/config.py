"""
Configuration pour les end-devices (clients HTTP)
"""
import os
from typing import Final

# URL de base de l'API Gateway (Nginx) pour SIGNING
GATEWAY_BASE_URL: Final[str] = os.getenv("GATEWAY_BASE_URL", "http://localhost:8080")

# URL directe du microservice device-management (pour éviter les soucis de 404 Nginx)
DEVICE_MS_BASE_URL: Final[str] = os.getenv(
    "DEVICE_MS_BASE_URL", "http://localhost:8001"
)

# Endpoints SIGNING via gateway
SIGNING_REGISTER_ENDPOINT: Final[str] = f"{GATEWAY_BASE_URL}/users/add"
SIGNING_AUTH_ENDPOINT: Final[str] = f"{GATEWAY_BASE_URL}/users/auth"

# Endpoints DEVICE-MANAGEMENT en direct (port 8001)
DEVICES_BASE_ENDPOINT: Final[str] = f"{DEVICE_MS_BASE_URL}/devices"

# Identifiants par défaut pour un utilisateur "client"
CLIENT_EMAIL: Final[str] = os.getenv("CLIENT_EMAIL", "end.device@example.com")
CLIENT_PASSWORD: Final[str] = os.getenv("CLIENT_PASSWORD", "password123")

# Intervalle d'envoi des métriques (secondes)
METRICS_INTERVAL: Final[int] = int(os.getenv("METRICS_INTERVAL", "5"))

