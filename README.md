# 🚀 Guide de Démarrage Rapide

## 🐳 Commandes Docker

```bash
# Démarrer le service Docker
sudo systemctl start docker

# Activer le démarrage automatique au boot
sudo systemctl enable docker

# Lancer les services en arrière-plan
docker compose up -d

# Lancer les services avec affichage des logs en direct
docker compose up

# ⚠️ Arrêter les services et supprimer les volumes persistants (efface la base de données et les modèles IA)
docker compose down -v

# Reconstruire les images et redémarrer les services
docker compose up -d --build

# Lister les modèles téléchargés (ex: mistral-small, nomic-embed-text)
docker exec -it ticket-ai-ollama ollama list

# Pour forcer ollama à relancer son script de démarage (si nouveau model)
docker compose up -d --force-recreate ollama
```

---

## 🔄 Commandes Git

```bash
# Récupérer des fichiers depuis une autre branche
git checkout frontend
git checkout master -- .gitignore

# Fusionner une branche (ex: backend)
git merge backend
```

---

## 📦 Installation Frontend (npm)

```bash
# Se placer dans le dossier du frontend
cd frontend

# Installer npm (si nécessaire)
sudo apt install npm

# Installer les dépendances
npm install
```

---

## 🌍 Mise en Production
Utiliser une **GitHub Action** + **RCD** pour le déploiement sur Azure.

---

## 🔗 Liens d’Accès

| Service        | URL                              | Identifiants                     |
|----------------|----------------------------------|----------------------------------|
| Frontend       | [http://localhost:3005](http://localhost:3005) | Interface utilisateur            |
| Backend API    | [http://localhost:8000](http://localhost:8000) / [http://localhost:8000/docs](http://localhost:8000/docs) | Documentation Swagger/Redoc |
| Open WebUI     | [http://localhost:3002](http://localhost:3002) | Interface pour Ollama            |
| pgAdmin        | [http://localhost:5050](http://localhost:5050) | Login: `admin@admin.com` / Pass: `admin` |
| Ollama         | [http://localhost:11434](http://localhost:11434) | API Ollama                       |

---

## 🗄️ Connexion à la Base de Données PostgreSQL

| Paramètre               | Valeur         |
|-------------------------|----------------|
| Name                    | (au choix)     |
| Host name/address       | `postgres`     |
| Port                    | `5432`         |
| Maintenance database    | `ticketdb`     |
| Username                | `admin`        |
| Password                | `Password1234` |


---

---

---



# Démarrer le service
sudo systemctl start docker
# Activer le démarrage automatique au boot
sudo systemctl enable docker
# Lancement en mode arriere-plan
docker compose up -d
# Lancement avec affichage des logs en direct
docker compose up
# Arret des services et suppression des volumes persistants
# Attention : Cette action efface la base de donnees et les modeles IA
docker compose down -v
# Reconstruction des images et redemarrage des services
docker compose up -d --build
# Liste des modeles telecharges (mistral-small, nomic-embed-text)
docker exec -it ticket-ai-ollama ollama list


# pour récupérer des fichiers de d'autre branche
git checkout frontend
git checkout master -- .gitignore

# pour récupérer toute une branche
git merge backend

pour installer npm sur le frontend
aller au :
- cd fronten
- sudo apt install npm
- npm install


utiliser un github action + rcd pour mise en prod sur azure

#liens d'accès
Frontend : http://localhost:3005  L'interface utilisateur de votre projet.
Backend API : http://localhost:8000 / http://localhost:8000/docs L'API FastAPI/Node (docs souvent sur /docs).
Open WebUI : http://localhost:3002  L'interface pour tester Ollama directement.
pgAdmin : http://localhost:5050  Login: admin@admin.com / Pass: admin.
Ollama : http://localhost:11434/


#connexion de la bdd à postgre
- Name : ce que vous voulez
- Host name/address : postgres
- Port : 5432
- Maintenance database : ticketdb
- Username : admin
- Password : Password1234