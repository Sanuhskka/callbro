# Multi-stage build for React client
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY packages/client/package*.json ./packages/client/

# Install dependencies
RUN npm ci --workspace=@secure-p2p-messenger/client

# Copy client source
COPY packages/client ./packages/client
COPY tsconfig.json ./

# Build the client
WORKDIR /app/packages/client
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html

# Copy nginx configuration
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
