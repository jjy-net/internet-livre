# Dockerfile para o Nó Completo Jjy (Web + WebSocket Relay Server)
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage de Produção
FROM node:20-alpine

# SEGURANÇA: Criar usuário não-root
RUN addgroup -g 1001 -S jjy && adduser -u 1001 -S jjy -G jjy

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4870

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server

# Garantir que o usuário jjy pode ler os arquivos
RUN chown -R jjy:jjy /app

EXPOSE 4870

# SEGURANÇA: Rodar como usuário não-root
USER jjy

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4870/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "server/start.js", "--porta=4870"]
