# End-Devices HTTP - Monitoring Cloud IoT 2025

Ce dossier contient les **clients HTTP end-devices** qui envoient des métriques
vers le microservice **Device Management** via la **gateway Nginx**.

Architecture :

End Device (PC, Laptop) → HTTP → `http://localhost:8080` → `/users`, `/devices`

## 📋 Prérequis

1. Les services Docker doivent être démarrés :
   ```bash
   cd ..
   docker-compose up -d
   ```

2. Python 3.8+

3. Installer les dépendances :
   ```bash
   cd end-devices
   pip install -r requirements.txt
   ```

## ⚙️ Configuration (`config.py`)

Variables principales :

- `BASE_URL` : URL de la gateway (par défaut `http://localhost:8080`)
- `CLIENT_EMAIL` / `CLIENT_PASSWORD` : compte utilisé pour obtenir le token JWT
- `METRICS_INTERVAL` : intervalle d'envoi des métriques (secondes)

Vous pouvez les surcharger via des variables d'environnement :

```bash
export BASE_URL=http://localhost:8080
export CLIENT_EMAIL=end.device@example.com
export CLIENT_PASSWORD=password123
export METRICS_INTERVAL=5
```

## 🚀 Utilisation

### 1. Lancer un end-device simple

```bash
cd end-devices
python quick_start.py end_device_001 "Salle A"
```

Ce script :
1. Authentifie l'utilisateur (`CLIENT_EMAIL`) via `/users/auth`
2. Crée le device `end_device_001` via `POST /devices/` (si nécessaire)
3. Envoie périodiquement des métriques système vers :
   `POST /devices/end_device_001/data`

### 2. Lancer directement le client

```bash
python end_device_client.py end_device_002 "Salle B"
```

## 📊 Métadonnées envoyées

Format des métriques envoyées à `/devices/{device_id}/data` :

```json
{
  "cpu_percent": 12.5,
  "memory_percent": 43.2,
  "disk_percent": 70.1,
  "temperature": 35.4,
  "status": "online"
}
```

Le microservice **Device Management** publie ensuite ces données sur RabbitMQ,
et le microservice **Monitoring** les stocke dans MongoDB.

## 🧪 Vérification

Pendant qu'un end-device tourne :

1. Vérifier les devices :
   ```http
   GET http://localhost:8080/devices/
   Authorization: Bearer <token>
   ```

2. Vérifier les données de monitoring :
   ```http
   GET http://localhost:8080/monitoring/data
   ```

Vous devriez voir les devices `end_device_XXX` et leurs métriques.

