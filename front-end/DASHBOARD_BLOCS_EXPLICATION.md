# Explication des blocs du Dashboard (page d’accueil)

Ce document décrit **à quoi correspond chaque bloc** de la première page (Dashboard) après connexion.

---

## En-tête

| Élément | Signification |
|--------|----------------|
| **Vue d’ensemble** | Titre de la page : c’est la vue synthétique de tout le système. |
| **Résumé temps réel des microservices Signing, Devices et Monitoring** | Sous-titre qui rappelle que les chiffres viennent des 3 microservices (authentification, gestion des appareils, collecte des mesures). |

---

## 1. Cartes KPIs (indicateurs clés)

Ce sont **6 petites cartes** en haut du Dashboard. Chacune affiche un chiffre ou une info importante.

| Bloc | Signification | D’où vient l’info ? |
|------|----------------|---------------------|
| **Devices enregistrés** | Nombre total d’appareils (capteurs / devices) enregistrés dans le système. | API **Device-Management** : liste des devices. |
| **En ligne** | Nombre de devices dont le statut est « online » (récemment actifs). | Même liste : on compte ceux avec `status === "online"`. |
| **Hors ligne** | Nombre de devices qui ne sont pas « online ». | Même liste : total − en ligne. |
| **Dernières mesures** | Nombre de mesures affichées dans l’aperçu (ici, jusqu’à 5). | API **Monitoring** : dernières données reçues (RabbitMQ → MongoDB). |
| **Dernier device actif** | L’**ID du device** qui a envoyé la **dernière mesure** reçue par le Monitoring. | Première ligne des dernières mesures du Monitoring. |
| **Tendance température** | Sur les dernières mesures : la température **monte** (↑), **descend** (↓) ou reste **stable** (→). | Comparaison entre la plus récente et la plus ancienne température dans l’aperçu. |

**Liens dans les cartes :**  
- « Voir la liste → » (Devices enregistrés) → page **Devices**.  
- « Monitoring → » / « Voir courbes → » (Dernières mesures, Dernier device actif) → page **Monitoring**.

---

## 2. Accès rapides

| Bloc | Signification |
|------|----------------|
| **Accès rapides** | Barre de **boutons** pour aller directement aux principales pages sans passer par le menu. |
| **Devices** | Ouvre la page de **gestion des devices** (liste, ajout, modification, suppression). |
| **Monitoring temps réel** | Ouvre la page **Monitoring** : tableau des mesures en direct + graphiques. |
| **Météo** | Ouvre la page **Météo** (prévisions, analyse météo / capteurs). |
| **Graphiques** | Ouvre aussi la page **Monitoring** (où se trouvent les graphiques par device). |

---

## 3. Dernières mesures en un coup d’œil (3 cartes)

| Bloc | Signification |
|------|----------------|
| **Les 3 petites cartes** | Chaque carte = **une des 3 dernières mesures** reçues par le Monitoring. |
| **Contenu d’une carte** | **Device** (ID), **température** (°C), **humidité** (%), **date/heure** de la mesure. |
| **Utilité** | Voir tout de suite les dernières valeurs sans ouvrir le tableau ni la page Monitoring. |

*(Ce bloc n’apparaît que s’il y a au moins une mesure.)*

---

## 4. Évolution température (aperçu) – mini-graphique

| Bloc | Signification |
|------|----------------|
| **Évolution température (aperçu)** | Petit **graphique en courbe** (sparkline) qui montre l’évolution de la **température** sur les **5 dernières mesures** (dans l’ordre du temps). |
| **Axe horizontal** | Heure des mesures. |
| **Axe vertical** | Température en °C. |
| **Utilité** | Voir en un coup d’œil si la température monte ou descend sur les derniers points. |
| **Lien « Voir graphiques complets → »** | Ouvre la page **Monitoring** pour les graphiques détaillés (device choisi, plage de dates, etc.). |

*(Ce bloc n’apparaît que s’il y a au moins 2 mesures avec température.)*

---

## 5. Dernières mesures (tableau)

| Bloc | Signification |
|------|----------------|
| **Dernières mesures (aperçu)** | **Tableau** avec les **5 dernières mesures** : Device, Temp., Humidité, Heure. |
| **Utilité** | Aperçu structuré des dernières données IoT ; même info que les 3 cartes mais pour les 5 mesures et en format tableau. |
| **Lien « Tout voir → »** | Ouvre la page **Monitoring** pour voir toutes les mesures et le flux temps réel. |

Si aucune donnée n’est disponible, le message affiché est :  
*« Aucune donnée. Lance un simulateur IoT ou un end-device. »*

---

## 6. Devices (résumé)

| Bloc | Signification |
|------|----------------|
| **Devices** | Liste des **IDs des devices** enregistrés (jusqu’à 12 affichés), sous forme de **pastilles cliquables**. |
| **Point vert (•)** | Device **online**. |
| **Point gris (•)** | Device **offline** (ou statut inconnu). |
| **Utilité** | Voir rapidement quels devices existent et lesquels sont actifs. |
| **Lien « Gérer → »** | Ouvre la page **Devices** pour gérer (créer, modifier, supprimer). |
| **« +X autres »** | S’il y a plus de 12 devices, indique combien ne sont pas affichés. |

---

## Récapitulatif : ordre des blocs sur la page

1. **En-tête** (titre + sous-titre)  
2. **Message d’erreur** (uniquement en cas d’échec de chargement)  
3. **6 cartes KPIs** (devices, en ligne, hors ligne, dernières mesures, dernier device actif, tendance)  
4. **Accès rapides** (boutons Devices, Monitoring, Météo, Graphiques)  
5. **3 cartes « Dernières mesures »** (si données)  
6. **Mini-graphique « Évolution température »** (si au moins 2 mesures)  
7. **Tableau « Dernières mesures (aperçu) »**  
8. **Bloc « Devices »** (liste des IDs en pastilles)  

---

*Document généré pour le projet Monitoring Cloud IoT 2025.*
