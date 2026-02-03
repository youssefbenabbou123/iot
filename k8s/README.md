# Kubernetes – Monitoring Cloud IoT 2025

Manifests pour déployer la stack sur un cluster Kubernetes (MicroK8s, K3s, minikube, etc.).

## Prérequis

- `kubectl` configuré vers votre cluster
- Images Docker des microservices : les déploiements utilisent `signing:latest`, `device-management:latest`, `monitoring:latest` en `imagePullPolicy: IfNotPresent`

## Build des images (exemple local)

```bash
# Depuis la racine du projet
docker build -t signing:latest ./Microservices/signing
docker build -t device-management:latest ./Microservices/device-management
docker build -t monitoring:latest ./Microservices/monitoring
```

Sur minikube : `eval $(minikube docker-env)` puis les commandes ci-dessus.  
Sur un cluster distant : pousser les images vers un registry et remplacer les noms d’images dans les manifests.

## Déploiement

```bash
# Créer le namespace et les ressources (ordre recommandé)
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-postgres.yaml
kubectl apply -f k8s/02-rabbitmq.yaml
kubectl apply -f k8s/02b-redis.yaml
kubectl apply -f k8s/03-mongodb.yaml
kubectl apply -f k8s/04-signing.yaml
kubectl apply -f k8s/05-device-management.yaml
kubectl apply -f k8s/06-monitoring.yaml
kubectl apply -f k8s/07-nginx.yaml
kubectl apply -f k8s/08-prometheus-config.yaml
kubectl apply -f k8s/09-node-exporter.yaml
kubectl apply -f k8s/10-prometheus.yaml
kubectl apply -f k8s/11-grafana.yaml
```

Ou en une fois :

```bash
kubectl apply -f k8s/
```

## Accès aux services

| Service | Port NodePort | Accès (Minikube) |
|---------|---------------|------------------|
| **Gateway (nginx)** | 30080 | `minikube service nginx -n monitoring-iot --url` |
| **Prometheus** | 30090 | `minikube service prometheus -n monitoring-iot --url` ou `http://<NODE_IP>:30090` |
| **Grafana** | 30300 | `minikube service grafana -n monitoring-iot --url` ou `http://<NODE_IP>:30300` |

- Grafana : `admin` / `admin` (à changer au premier login). Ajouter la source Prometheus : URL `http://prometheus:9090`
- Prometheus : onglet « Status » → « Targets » pour vérifier les scrapes

## Ordre de démarrage

Postgres, RabbitMQ, Redis et MongoDB doivent être prêts avant les microservices (signing et device-management utilisent Redis). Les déploiements n’incluent pas d’init containers ; en cas de démarrage trop rapide, redémarrer les pods signing, device-management et monitoring :

```bash
kubectl rollout restart deployment signing device-management monitoring -n monitoring-iot
```

## Suppression

```bash
kubectl delete -f k8s/
# ou
kubectl delete namespace monitoring-iot
```
