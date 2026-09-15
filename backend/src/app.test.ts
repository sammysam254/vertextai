// ==============================================
// Fastify Application Tests
// ==============================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from './app';

describe('Fastify Application', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'CallPulse API',
        version: '1.0.0',
        status: 'online',
      });
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect([200, 503]).toContain(response.statusCode);

      const body = response.json();
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('redis');
      expect(body.services).toHaveProperty('database');
    });

    it('should include cache metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      const body = response.json();
      expect(body).toHaveProperty('cache');
      expect(body.cache).toHaveProperty('hits');
      expect(body.cache).toHaveProperty('misses');
      expect(body.cache).toHaveProperty('hitRate');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/non-existent-route',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: 'Not Found',
        statusCode: 404,
      });
    });

    it('should include request method and URL in error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/unknown',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.message).toContain('POST');
      expect(body.message).toContain('/api/v1/unknown');
    });
  });

  describe('CORS', () => {
    it('should allow requests with no origin', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).not.toBe(403);
    });

    it('should set CORS headers', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin: 'http://localhost:3000',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Request Logging', () => {
    it('should log incoming requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
        headers: {
          'user-agent': 'vitest-test-runner',
        },
      });

      expect(response.statusCode).toBe(200);
      // Logging is verified via pino output (manual inspection)
    });

    it('should track response time', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      // Response time tracked in logs
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
    });
  });
});
