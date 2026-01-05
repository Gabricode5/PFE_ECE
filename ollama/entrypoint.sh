#!/bin/bash
# Lancer Ollama en arrière-plan
/bin/ollama serve &
# Attendre que le service soit prêt
sleep 5
# Télécharger les modèles définis dans le .env (ou en dur ici)
echo "📥 Téléchargement de Mistral-small..."
ollama pull mistral-small
echo "📥 Téléchargement de Nomic-Embed-Text..."
ollama pull nomic-embed-text
# Garder le conteneur actif
wait