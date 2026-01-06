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