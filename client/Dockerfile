# Development image for the React app (Vite dev server). Source is bind-mounted by compose.yaml.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chown -R node:node /app
USER node

EXPOSE 5173
CMD ["npm", "run", "dev"]
