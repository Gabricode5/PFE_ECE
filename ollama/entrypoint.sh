#!/bin/bash

# 1. Lancer le serveur Ollama en arrière-plan
ollama serve &

# 2. Attendre que le serveur démarre (pause de 5 secondes au lieu de curl)
echo "Attente du démarrage d'Ollama (5s)..."
sleep 5

# 3. Pull le modèle
echo "Téléchargement du modèle llama3.2:1b..."
ollama pull llama3.2:1b

echo "Installation terminée et modèle prêt !"

# 4. Maintenir le processus actif
wait