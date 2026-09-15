// ==============================================
// Organization Cache Tests
// ==============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { redis } from '@/lib/redis';
import {
  getCachedOrganizationByPhone,
  setOrganizationCache,
  invalidateOrganizationCache,
} from './organization.cache';
import type { Organization } from '@/types';

// Mock organization data
const mockOrg: Organization = {
  id: 'test-org-id-123',
  name: 'Test Organization',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  twilio_account_sid: 'ACtest123',
  twilio_auth_token: 'test_token',
  twilio_phone_number: '+15555551234',
  ai_system_prompt: 'Test prompt',
  ai_voice_id: 'Polly.Joanna-Neural',
  ai_model: 'llama-3.1-8b-instant',
  escalation_phone_number: '+15555559999',
  escalation_keywords: ['human', 'agent'],
  subscription_tier: 'pro',
  metadata: {},
};

describe('Organization Cache', () => {
  beforeEach(async () => {
    // Clear test keys before each test
    await redis.flushdb();
  });

  afterEach(async () => {
    // Clean up after each test
    await redis.flushdb();
  });

  describe('getCachedOrganizationByPhone', () => {
    it('should return null on cache miss', async () => {
      const result = await getCachedOrganizationByPhone('+15555551234');
      expect(result).toBeNull();
    });

    it('should return organization on cache hit', async () => {
      // Set cache
      await setOrganizationCache(mockOrg);

      // Get from cache
      const result = await getCachedOrganizationByPhone('+15555551234');

      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockOrg.id);
      expect(result?.name).toBe(mockOrg.name);
      expect(result?.twilio_phone_number).toBe(mockOrg.twilio_phone_number);
    });

    it('should handle JSON parsing errors gracefully', async () => {
      // Set invalid JSON manually
      await redis.set('org:phone:+15555551234', 'invalid-json');

      const result = await getCachedOrganizationByPhone('+15555551234');
      expect(result).toBeNull();
    });
  });

  describe('setOrganizationCache', () => {
    it('should cache organization with both phone and ID keys', async () => {
      await setOrganizationCache(mockOrg);

      // Check both keys exist
      const byPhone = await redis.get('org:phone:+15555551234');
      const byId = await redis.get(`org:id:${mockOrg.id}`);

      expect(byPhone).not.toBeNull();
      expect(byId).not.toBeNull();

      // Verify data integrity
      const parsedByPhone = JSON.parse(byPhone!);
      expect(parsedByPhone.id).toBe(mockOrg.id);
    });

    it('should set TTL on cached entries', async () => {
      await setOrganizationCache(mockOrg);

      const ttlByPhone = await redis.ttl('org:phone:+15555551234');
      const ttlById = await redis.ttl(`org:id:${mockOrg.id}`);

      // TTL should be positive (not -1 or -2)
      expect(ttlByPhone).toBeGreaterThan(0);
      expect(ttlById).toBeGreaterThan(0);
    });
  });

  describe('invalidateOrganizationCache', () => {
    it('should remove all cache entries for organization', async () => {
      // Set cache
      await setOrganizationCache(mockOrg);

      // Verify entries exist
      let byPhone = await redis.get('org:phone:+15555551234');
      let byId = await redis.get(`org:id:${mockOrg.id}`);
      expect(byPhone).not.toBeNull();
      expect(byId).not.toBeNull();

      // Invalidate
      await invalidateOrganizationCache(mockOrg.id, mockOrg.twilio_phone_number);

      // Verify entries removed
      byPhone = await redis.get('org:phone:+15555551234');
      byId = await redis.get(`org:id:${mockOrg.id}`);
      expect(byPhone).toBeNull();
      expect(byId).toBeNull();
    });

    it('should handle invalidation when phone not provided', async () => {
      await setOrganizationCache(mockOrg);

      // Invalidate without phone
      await invalidateOrganizationCache(mockOrg.id);

      // Verify ID entry removed
      const byId = await redis.get(`org:id:${mockOrg.id}`);
      expect(byId).toBeNull();
    });
  });

  describe('Cache-Aside Pattern Performance', () => {
    it('should complete cache hit in < 5ms', async () => {
      await setOrganizationCache(mockOrg);

      const startTime = Date.now();
      await getCachedOrganizationByPhone('+15555551234');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5);
    });
  });
});
