# ==============================================
# Multi-stage Dockerfile for CallPulse
# Builds both backend (Fastify) and frontend (Next.js static) in one container
# ==============================================

# Stage 1: Build Next.js Frontend (Static Export)
FROM node:20-alpine AS frontend-builder

WORKDIR /app/web

# Copy frontend package files
COPY web/package*.json ./
RUN npm install

# Copy frontend source
COPY web ./

# Build Next.js as static export
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./
RUN npm install

# Copy backend source
COPY backend ./

# Build TypeScript backend
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Stage 3: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy backend dist and node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package*.json ./

# Copy Next.js static export to public directory
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/out ./public

# Set environment to production
ENV NODE_ENV=production
ENV PORT=5050

# Expose port
EXPOSE 5050

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5050/api/v1/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start backend server (serves API + static frontend)
CMD ["node", "dist/server.js"]
