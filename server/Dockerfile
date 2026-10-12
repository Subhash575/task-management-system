# Development image for the API. Source code is bind-mounted by compose.yaml.
FROM node:24-alpine

WORKDIR /app

# Install dependencies first so this layer is cached until package files change.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Run as the unprivileged "node" user that ships with the official image.
# Folder for local-development uploads (a named volume in compose.yaml keeps them between restarts).
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 5000
CMD ["npm", "run", "dev"]
