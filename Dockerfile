# Dockerfile para o Nó Completo Jyy (Web + WebSocket Relay Server)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage de Produção
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4870

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server

EXPOSE 4870

CMD ["node", "server/start.js", "--porta=4870"]
