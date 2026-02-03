# Préparation de l'environnement Kubernetes

Ce guide explique comment installer **kubectl** et créer un **cluster** sur Windows, pour pouvoir déployer le projet Monitoring Cloud IoT 2025.

---

## 1. Différence entre kubectl et le cluster

| Élément | Rôle |
|---------|------|
| **kubectl** | Outil en ligne de commande pour piloter Kubernetes (comme `docker` pour Docker) |
| **Cluster** | L'environnement Kubernetes qui exécute les applications (ex. minikube crée un cluster local) |

**Les deux sont nécessaires :** kubectl pour donner les ordres, le cluster pour les exécuter.

---

## 2. Option recommandée : Minikube (simple sur Windows)

Minikube crée un cluster Kubernetes dans une machine virtuelle sur ton PC.

### Étape A – Vérifier les prérequis

- **Docker Desktop** installé et démarré (tu l'as déjà)
- **Hyper-V** ou **VirtualBox** activé (souvent déjà le cas avec Docker)

### Étape B – Installer kubectl

**Via Chocolatey :**
```powershell
choco install kubernetes-cli
```

**Ou téléchargement manuel :**
1. Aller sur https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/
2. Télécharger `kubectl.exe`
3. Le placer dans un dossier du PATH (ex. `C:\Windows\System32`)

**Vérification :**
```powershell
kubectl version --client
```

### Étape C – Installer Minikube

**Via Chocolatey :**
```powershell
choco install minikube
```

**Ou téléchargement direct :**
1. Aller sur https://minikube.sigs.k8s.io/docs/start/
2. Télécharger `minikube-installer.exe` pour Windows
3. Exécuter l’installateur

**Vérification :**
```powershell
minikube version
```

### Étape D – Démarrer le cluster

```powershell
minikube start --driver=docker
```

Minikube utilise Docker pour créer le cluster (pas besoin de VirtualBox).

**Vérification :**
```powershell
kubectl cluster-info
kubectl get nodes
```

Si tu vois un nœud `Ready`, le cluster est prêt.

---

## 3. Alternative : Docker Desktop avec Kubernetes

Docker Desktop peut activer un cluster Kubernetes intégré.

1. Ouvrir **Docker Desktop** → **Settings** → **Kubernetes**
2. Cocher **Enable Kubernetes**
3. Cliquer **Apply & Restart**
4. Attendre la fin du démarrage (icône verte)

Ensuite :
```powershell
kubectl config use-context docker-desktop
kubectl cluster-info
```

---

## 4. Une fois l’environnement prêt

Quand `kubectl cluster-info` répond correctement :

```powershell
cd "c:\Users\pc\Desktop\Cloud et iot\Monitoring-Cloud-IoT-2025"

# Construire les images (avec Minikube, pointer Docker vers Minikube)
minikube docker-env   # Affiche les commandes à exécuter
# Puis : eval $(minikube docker-env)  (ou équivalent PowerShell)

docker build -t signing:latest ./Microservices/signing
docker build -t device-management:latest ./Microservices/device-management
docker build -t monitoring:latest ./Microservices/monitoring

# Déployer
kubectl apply -f k8s/
```

---

## 5. Résumé des commandes à exécuter (dans l’ordre)

| Ordre | Commande | Rôle |
|-------|----------|------|
| 1 | `choco install kubernetes-cli` | Installer kubectl |
| 2 | `choco install minikube` | Installer Minikube |
| 3 | `minikube start --driver=docker` | Démarrer le cluster |
| 4 | `kubectl cluster-info` | Vérifier que tout est OK |

---

## 6. En cas de problème

- **Chocolatey non installé :** https://chocolatey.org/install  
- **Minikube ne démarre pas :** vérifier que Docker Desktop est lancé  
- **Erreur Hyper-V :** utiliser `minikube start --driver=docker`
