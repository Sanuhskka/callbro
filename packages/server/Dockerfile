# Multi-stage build for Node.js server
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

# Install dependencies
RUN npm ci --workspace=@secure-p2p-messenger/server

# Copy server source
COPY packages/server ./packages/server
COPY tsconfig.json ./

# Build the server
WORKDIR /app/packages/server
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
COPY packages/server/package*.json ./packages/server/
RUN npm ci --workspace=@secure-p2p-messenger/server --omit=dev

# Copy built files
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY packages/server/src/db ./packages/server/src/db

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose WebSocket port
EXPOSE 8081

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8081/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "packages/server/dist/index.js"]
