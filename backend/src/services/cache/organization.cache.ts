// ==============================================
// Organization Caching Service
// ==============================================

import { config } from '@/lib/config';
import { createLogger } from '@/lib/logger';
import {
  CacheKeys,
  getCached,
  setCached,
  deleteCached,
  deleteCachedPattern,
} from '@/lib/redis';
import type { Organization } from '@/types';

const logger = createLogger('cache:organization');

// ==============================================
// Get Organization (Cache-Aside Pattern)
// ==============================================

/**
 * Get organization by phone number (cache-aside pattern)
 * 1. Check Redis cache first
 * 2. On miss, caller provides DB fallback
 * 3. Store result in cache
 */
export async function getCachedOrganizationByPhone(
  phone: string
): Promise<Organization | null> {
  const key = CacheKeys.orgByPhone(phone);

  try {
    const cached = await getCached<Organization>(key);
    if (cached) {
      logger.debug({ phone }, 'Organization cache HIT (by phone)');
      return cached;
    }

    logger.debug({ phone }, 'Organization cache MISS (by phone)');
    return null;
  } catch (error) {
    logger.error({ error, phone }, 'Error getting cached organization by phone');
    return null;
  }
}

/**
 * Get organization by ID (cache-aside pattern)
 */
export async function getCachedOrganizationById(
  orgId: string
): Promise<Organization | null> {
  const key = CacheKeys.orgById(orgId);

  try {
    const cached = await getCached<Organization>(key);
    if (cached) {
      logger.debug({ orgId }, 'Organization cache HIT (by ID)');
      return cached;
    }

    logger.debug({ orgId }, 'Organization cache MISS (by ID)');
    return null;
  } catch (error) {
    logger.error({ error, orgId }, 'Error getting cached organization by ID');
    return null;
  }
}

// ==============================================
// Set Organization Cache
// ==============================================

/**
 * Cache organization with both phone and ID keys
 */
export async function setOrganizationCache(org: Organization): Promise<void> {
  const ttl = config.cacheOrgTtl;

  try {
    // Cache by phone number (primary lookup key for webhooks)
    await setCached(CacheKeys.orgByPhone(org.twilio_phone_number), org, ttl);

    // Cache by ID (for dashboard queries)
    await setCached(CacheKeys.orgById(org.id), org, ttl);

    logger.info(
      { orgId: org.id, phone: org.twilio_phone_number, ttl },
      'Organization cached successfully'
    );
  } catch (error) {
    logger.error({ error, orgId: org.id }, 'Error setting organization cache');
  }
}

// ==============================================
// Invalidate Organization Cache
// ==============================================

/**
 * Invalidate all cache entries for an organization
 * Called when organization settings are updated
 */
export async function invalidateOrganizationCache(
  orgId: string,
  phone?: string
): Promise<void> {
  try {
    // Delete by ID
    await deleteCached(CacheKeys.orgById(orgId));

    // Delete by phone if provided
    if (phone) {
      await deleteCached(CacheKeys.orgByPhone(phone));
    } else {
      // If phone not provided, delete all org:phone:* entries
      // (less efficient but ensures complete invalidation)
      await deleteCachedPattern(`org:phone:*`);
    }

    logger.info({ orgId, phone }, 'Organization cache invalidated');
  } catch (error) {
    logger.error({ error, orgId }, 'Error invalidating organization cache');
  }
}

/**
 * Invalidate all organization caches (use sparingly)
 */
export async function invalidateAllOrganizations(): Promise<void> {
  try {
    const phoneDeleted = await deleteCachedPattern('org:phone:*');
    const idDeleted = await deleteCachedPattern('org:id:*');

    logger.warn(
      { phoneDeleted, idDeleted },
      'All organization caches invalidated'
    );
  } catch (error) {
    logger.error({ error }, 'Error invalidating all organization caches');
  }
}

// ==============================================
// Warm Cache (Pre-populate)
// ==============================================

/**
 * Pre-populate cache with organization data
 * Useful after system startup or cache flush
 */
export async function warmOrganizationCache(org: Organization): Promise<void> {
  await setOrganizationCache(org);
  logger.info({ orgId: org.id }, 'Organization cache warmed');
}
