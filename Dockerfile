# ==============================================
# Simplified Dockerfile - Use tsx to run TypeScript directly
# ==============================================

FROM node:20-alpine AS base

# Stage 1: Install Backend Dependencies
FROM base AS backend-builder
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install

COPY backend ./

# Stage 2: Build Frontend  
FROM base AS frontend-builder
WORKDIR /app/web

COPY web/package*.json ./
RUN npm install

COPY web ./

# Hardcode Next.js public env vars (these are public/non-secret)
ENV NEXT_PUBLIC_SUPABASE_URL=https://cnezekhsnitmhptzlfys.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZXpla2hzbml0bWhwdHpsZnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTU0NjgsImV4cCI6MjEwNTA3MTQ2OH0.ya9x8i5dJKo1ntrTMhhWe5rbBOcnke_8ZIgfHL9xOMs
ENV NEXT_PUBLIC_API_URL=https://vertextai-3lit.onrender.com
ENV NEXT_PUBLIC_TWILIO_PHONE=+12513571708
ENV DOCKER_BUILD=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runtime
FROM base AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy backend source and node_modules (run with tsx, no build needed)
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/src ./backend/src
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/package.json ./backend/
COPY --from=backend-builder --chown=nodejs:nodejs /app/backend/tsconfig.json ./backend/

# Copy Next.js standalone
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/.next/standalone ./
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/.next/static ./.next/static
COPY --from=frontend-builder --chown=nodejs:nodejs /app/web/public ./public

# Create startup script that runs both
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'cd /app/backend && PORT=5050 npx tsx src/server.ts &' >> /app/start.sh && \
    echo 'BACKEND_PID=$!' >> /app/start.sh && \
    echo 'sleep 3' >> /app/start.sh && \
    echo 'cd /app && HOSTNAME=0.0.0.0 PORT=3000 node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nodejs:nodejs /app/start.sh

ENV NODE_ENV=production
EXPOSE 3000
USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "/app/start.sh"]
