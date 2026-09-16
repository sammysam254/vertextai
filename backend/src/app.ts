// ==============================================
// Fastify Application Configuration
// ==============================================

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { config } from './lib/config';
import { redis, checkRedisHealth, getCacheMetrics } from './lib/redis';
import { checkDatabaseHealth } from './lib/supabase';

// Create Fastify instance
export const app = Fastify({
  logger: {
    level: config.nodeEnv === 'production' ? 'info' : 'debug',
  },
  trustProxy: true,
  requestIdLogLabel: 'reqId',
  disableRequestLogging: false,
  requestIdHeader: 'x-request-id',
});

// ==============================================
// Plugins
// ==============================================

// CORS Configuration
await app.register(cors, {
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      cb(null, true);
      return;
    }

    // Allow all origins in development
    if (config.nodeEnv === 'development') {
      cb(null, true);
      return;
    }

    // Whitelist specific domains + all *.onrender.com and localhost
    const allowedOrigins = [
      'https://callpulse-web.onrender.com',
      'https://callpulse.io',
      'https://www.callpulse.io',
      'https://vertextai-3lit.onrender.com',
    ];

    const isAllowed =
      allowedOrigins.includes(origin) ||
      origin.endsWith('.onrender.com') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1');

    if (isAllowed) {
      cb(null, true);
    } else {
      cb(null, true); // Allow all web origins to access API seamlessly
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: false, // Disable CSP for API server
  crossOriginEmbedderPolicy: false,
});

// WebSocket support
await app.register(websocket, {
  options: {
    maxPayload: 1048576, // 1MB
    clientTracking: true,
  },
});

// ==============================================
// Global Hooks
// ==============================================

// Request logging
app.addHook('onRequest', async (request, reply) => {
  request.log.info(
    {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    },
    'Incoming request'
  );
});

// Response time tracking
app.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

app.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - (request.startTime || Date.now());
  request.log.info(
    {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime,
    },
    'Request completed'
  );
});

// Error handling
app.addHook('onError', async (request, reply, error) => {
  request.log.error(
    {
      error,
      method: request.method,
      url: request.url,
    },
    'Request error'
  );
});

// ==============================================
// Custom Type Extensions
// ==============================================

declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// ==============================================
// Health Check Endpoint
// ==============================================

app.get('/api/v1/health', async (request, reply) => {
  try {
    // Check Redis health
    const redisHealth = await checkRedisHealth();

    // Check database health
    const dbHealth = await checkDatabaseHealth();

    // Get cache metrics
    const cacheMetrics = getCacheMetrics();

    const overallStatus =
      redisHealth.status === 'up' && dbHealth.status === 'up'
        ? 'healthy'
        : redisHealth.status === 'down' || dbHealth.status === 'down'
          ? 'unhealthy'
          : 'degraded';

    return reply.status(overallStatus === 'healthy' ? 200 : 503).send({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth,
        database: dbHealth,
        twilio: { status: 'up' }, // Placeholder - actual check in Twilio service
      },
      cache: cacheMetrics,
    });
  } catch (error) {
    request.log.error({ error }, 'Health check failed');
    return reply.status(503).send({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// ==============================================
// Root Endpoint
// ==============================================

app.get('/', async () => {
  return {
    name: 'CallPulse API',
    version: '1.0.0',
    status: 'online',
    documentation: '/api/v1/docs',
  };
});

// ==============================================
// 404 Handler
// ==============================================

app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
  });
});

// ==============================================
// Global Error Handler
// ==============================================

app.setErrorHandler((error, request, reply) => {
  request.log.error(
    {
      error,
      method: request.method,
      url: request.url,
    },
    'Unhandled error'
  );

  // Twilio signature validation errors
  if (error.message?.includes('Invalid Twilio signature')) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Invalid webhook signature',
      statusCode: 403,
    });
  }

  // Validation errors (Zod, etc.)
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      details: error.validation,
      statusCode: 400,
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
    message: error.message || 'An error occurred',
    statusCode,
  });
});

// ==============================================
// Graceful Shutdown
// ==============================================

const gracefulShutdown = async (signal: string) => {
  app.log.info(`${signal} signal received, starting graceful shutdown...`);

  try {
    // Close Fastify server (stop accepting new requests)
    await app.close();
    app.log.info('Fastify server closed');

    // Close Redis connection
    await redis.quit();
    app.log.info('Redis connection closed');

    // Close database connections (if applicable)
    // TODO: Add database cleanup when Supabase service is built

    app.log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    app.log.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
