#!/bin/bash

# Lancer le serveur Ollama en arrière-plan
ollama serve &

# Attendre que le service soit prêt
echo "Attente du serveur Ollama..."
while ! curl -s http://localhost:11434/api/tags > /dev/null; do
    sleep 2
done

# Télécharger le modèle léger pour ta RTX 3050
echo "Téléchargement du modèle llama3.2:1b..."
ollama pull llama3.2:1b

echo "Installation terminée !"
# Garder le processus au premier plan
wait