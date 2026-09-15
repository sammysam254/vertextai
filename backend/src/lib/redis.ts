// ==============================================
// Redis Client Configuration
// ==============================================

import Redis, { type RedisOptions } from 'ioredis';
import { config } from './config';
import { createLogger } from './logger';

const logger = createLogger('redis');

// Redis connection configuration
const getRedisConfig = (): RedisOptions => {
  // Check if REDIS_URL is provided (production/Render)
  if (config.redisUrl) {
    logger.info('Using REDIS_URL connection string');
    return {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`Redis connection retry #${times}, delay: ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          logger.warn('Redis READONLY error detected, reconnecting...');
          return true;
        }
        return false;
      },
      commandTimeout: 5000,
      keepAlive: 30000,
    };
  }

  // Use discrete host/port/password (local development)
  logger.info(
    `Using discrete Redis config: ${config.redisHost}:${config.redisPort}`
  );
  return {
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      // Stop retrying after 3 attempts if Redis is not available
      if (times > 3) {
        logger.warn('Redis not available, disabling retries');
        return null; // stop retrying
      }
      const delay = Math.min(times * 50, 500);
      logger.warn(`Redis connection retry #${times}, delay: ${delay}ms`);
      return delay;
    },
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        logger.warn('Redis READONLY error detected, reconnecting...');
        return true;
      }
      return false;
    },
    commandTimeout: 5000,
    keepAlive: 30000,
  };
};

// Create Redis client instance
export const redis = config.redisUrl
  ? new Redis(config.redisUrl, getRedisConfig())
  : new Redis(getRedisConfig());

// Connection event handlers
redis.on('connect', () => {
  logger.info('✓ Redis connected successfully');
});

redis.on('ready', () => {
  logger.info('✓ Redis ready to accept commands');
});

redis.on('error', (err) => {
  logger.error({ err }, '✗ Redis connection error');
  // Don't throw - allow graceful degradation
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', (delay: number) => {
  logger.info(`Redis reconnecting in ${delay}ms...`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing Redis connection...');
  await redis.quit();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing Redis connection...');
  await redis.quit();
});

// ==============================================
// Cache Metrics
// ==============================================

let cacheHits = 0;
let cacheMisses = 0;

export function incrementCacheHit() {
  cacheHits++;
}

export function incrementCacheMiss() {
  cacheMisses++;
}

export function getCacheMetrics() {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

export function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
}

// ==============================================
// Redis Health Check
// ==============================================

export async function checkRedisHealth(): Promise<{
  status: 'up' | 'down';
  latency?: number;
}> {
  const startTime = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - startTime;
    return { status: 'up', latency };
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    return { status: 'down' };
  }
}

// ==============================================
// Cache Key Generators
// ==============================================

export const CacheKeys = {
  // Organization caching
  orgByPhone: (phone: string) => `org:phone:${phone}`,
  orgById: (orgId: string) => `org:id:${orgId}`,

  // Call state caching
  callState: (callSid: string) => `call:${callSid}`,

  // SMS conversation context
  smsContext: (orgId: string, contactPhone: string) =>
    `sms:conversation:${orgId}:${contactPhone}`,

  // Rate limiting
  rateLimit: (orgId: string, endpoint: string) =>
    `ratelimit:org:${orgId}:${endpoint}`,
} as const;

// ==============================================
// Generic Cache Operations
// ==============================================

/**
 * Get cached value with JSON parsing
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      incrementCacheHit();
      return JSON.parse(cached) as T;
    }
    incrementCacheMiss();
    return null;
  } catch (error) {
    logger.error({ error, key }, 'Cache get error');
    incrementCacheMiss();
    return null;
  }
}

/**
 * Set cached value with JSON serialization
 */
export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  } catch (error) {
    logger.error({ error, key }, 'Cache set error');
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Delete cached value
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    logger.error({ error, key }, 'Cache delete error');
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function deleteCachedPattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    const deleted = await redis.del(...keys);
    logger.info({ pattern, count: deleted }, 'Deleted cached keys by pattern');
    return deleted;
  } catch (error) {
    logger.error({ error, pattern }, 'Cache delete pattern error');
    return 0;
  }
}

/**
 * Check if key exists in cache
 */
export async function existsInCache(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error({ error, key }, 'Cache exists check error');
    return false;
  }
}

/**
 * Get TTL for a key
 */
export async function getTTL(key: string): Promise<number> {
  try {
    return await redis.ttl(key);
  } catch (error) {
    logger.error({ error, key }, 'Cache TTL check error');
    return -1;
  }
}

/**
 * Increment counter with optional expiration
 */
export async function incrementCounter(
  key: string,
  ttlSeconds?: number
): Promise<number> {
  try {
    const value = await redis.incr(key);
    if (ttlSeconds && value === 1) {
      // Set expiration only on first increment
      await redis.expire(key, ttlSeconds);
    }
    return value;
  } catch (error) {
    logger.error({ error, key }, 'Counter increment error');
    return 0;
  }
}

// ==============================================
// Graceful Degradation Helper
// ==============================================

/**
 * Execute operation with Redis, fallback on error
 */
export async function withRedisOrFallback<T>(
  redisOp: () => Promise<T>,
  fallbackOp: () => Promise<T>
): Promise<T> {
  try {
    // Check if Redis is connected
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      logger.warn('Redis not ready, using fallback');
      return await fallbackOp();
    }

    return await redisOp();
  } catch (error) {
    logger.warn({ error }, 'Redis operation failed, using fallback');
    return await fallbackOp();
  }
}
