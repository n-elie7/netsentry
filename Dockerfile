# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Stage 2: Production image
FROM node:18-alpine AS production
WORKDIR /app

RUN addgroup -S netsentry && adduser -S netsentry -G netsentry

COPY --from=deps /app/node_modules ./node_modules

COPY config/ ./config/
COPY database/ ./database/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY services/ ./services/
COPY utils/ ./utils/
COPY frontend/ ./frontend/
COPY server.js package.json ./

RUN mkdir -p /app/data && chown -R netsentry:netsentry /app

# switch to non-root user
USER netsentry

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
