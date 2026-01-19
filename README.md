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