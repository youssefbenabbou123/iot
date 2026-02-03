# Simulateurs IoT - Monitoring Cloud IoT 2025

Ce dossier contient les simulateurs de capteurs IoT qui publient des données sur RabbitMQ pour être consommées par le service Monitoring.

## 📋 Prérequis

1. **RabbitMQ doit être démarré** (via `docker-compose up -d`)
2. **Python 3.8+**
3. **Installation des dépendances** :
   ```bash
   pip install -r requirements.txt
   ```

## 🚀 Utilisation

### 1. Simulateur simple (un seul capteur)

#### Capteur de température
```bash
python sensor_simulator.py device_001 temperature 5
```
- `device_001` : ID du device
- `temperature` : Type de capteur
- `5` : Intervalle entre les envois (secondes)

#### Capteur d'humidité
```bash
python sensor_simulator.py device_002 humidity 7
```

#### Multi-capteur (température + humidité)
```bash
python sensor_simulator.py device_003 multi 5
```

### 2. Lancer plusieurs simulateurs en parallèle

```bash
python run_multiple_sensors.py
```

Ce script lance automatiquement plusieurs capteurs configurés dans le fichier.

## ⚙️ Configuration

Les paramètres peuvent être modifiés via des variables d'environnement :

```bash
export RABBITMQ_HOST=localhost
export RABBITMQ_PORT=5672
export RABBITMQ_USER=guest
export RABBITMQ_PASSWORD=guest
export RABBITMQ_EXCHANGE=device_events
export SEND_INTERVAL=5
```

Ou créer un fichier `.env` dans ce dossier.

## 📊 Format des données

Les simulateurs publient des messages au format suivant sur RabbitMQ :

```json
{
  "event_type": "device.data",
  "timestamp": "2025-01-28T20:00:00Z",
  "device_id": "device_001",
  "data": {
    "device_id": "device_001",
    "temperature": 25.5,
    "status": "online",
    "timestamp": "2025-01-28T20:00:00Z"
  }
}
```

Le service Monitoring consomme ces messages et les stocke dans MongoDB.

## 🧪 Test

1. **Démarrer les services** :
   ```bash
   cd ..
   docker-compose up -d
   ```

2. **Lancer un simulateur** :
   ```bash
   python sensor_simulator.py device_001 temperature 5
   ```

3. **Vérifier les données dans MongoDB** :
   - Via l'API Monitoring : `GET http://localhost:8080/monitoring/data`
   - Ou directement dans MongoDB

## 📝 Notes

- Les simulateurs s'arrêtent avec `Ctrl+C`
- Les données sont publiées sur l'exchange `device_events` avec le routing key `device.data`
- Le service Monitoring consomme automatiquement ces messages et les stocke dans MongoDB
