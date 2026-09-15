# ==============================================
# Simplified Dockerfile - Next.js with API rewrites
# ==============================================

FROM node:20-alpine AS base

# Stage 1: Build Backend
FROM base AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend ./
RUN npm run build && npm prune --production

# Stage 2: Build Frontend  
FROM base AS frontend-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm install

COPY web ./
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runtime
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy backend
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/dist ./backend/dist
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/

# Copy Next.js standalone
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/.next/standalone ./
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/.next/static ./.next/static
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/public ./public

# Create startup script that runs both
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/backend && node dist/server.js &' >> /app/start.sh && \
    echo 'BACKEND_PID=$!' >> /app/start.sh && \
    echo 'cd /app && node server.js &' >> /app/start.sh && \
    echo 'FRONTEND_PID=$!' >> /app/start.sh && \
    echo 'wait $BACKEND_PID $FRONTEND_PID' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nodejs:nodejs /app/start.sh

ENV NODE_ENV=production
EXPOSE 3000
USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "/app/start.sh"]
