# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci

# Copy source code
COPY backend ./backend
COPY tsconfig.json ./

# Build TypeScript
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY --from=builder /app/backend/package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built application
COPY --from=builder /app/backend/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 5050

CMD ["node", "dist/server.js"]
