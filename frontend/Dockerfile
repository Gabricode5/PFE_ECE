FROM node:20-slim

WORKDIR /app

# On copie uniquement les fichiers de dépendances pour le cache
COPY package.json package-lock.json* ./

# Installation propre via npm
RUN npm ci

# Copie du reste de ton code (app, components, etc.)
COPY . .

# Build production
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3005

# Le port interne sur lequel Next.js écoute
EXPOSE 3005

# Démarrage production, compatible Render (variable PORT injectée)
CMD ["sh", "-c", "npm run start -- -p ${PORT:-3005}"]
