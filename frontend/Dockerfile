FROM node:20-slim

WORKDIR /app

# On copie uniquement les fichiers de dépendances pour le cache
COPY package.json package-lock.json* ./

# Installation propre via npm
RUN npm install

# Copie du reste de ton code (app, components, etc.)
COPY . .

# Le port interne sur lequel Next.js va écouter
EXPOSE 3005

# On lance le serveur en spécifiant le port 3005
CMD ["npm", "run", "dev", "--", "-p", "3005"]