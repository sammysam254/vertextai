// ==============================================
// Test Setup & Global Configuration
// ==============================================

import { beforeAll, afterAll, beforeEach } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Use 'error' instead of 'silent'
process.env.PORT = '5051'; // Use different port for tests
process.env.BASE_URL = 'http://localhost:5051'; // Add base URL

// Mock environment variables if not set
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}

if (!process.env.GROQ_API_KEY) {
  process.env.GROQ_API_KEY = 'test-groq-key';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-32-characters-long';
}

if (!process.env.REDIS_HOST) {
  process.env.REDIS_HOST = 'localhost';
  process.env.REDIS_PORT = '6379';
}

// Global test hooks
beforeAll(async () => {
  // Setup code that runs once before all tests
});

afterAll(async () => {
  // Cleanup code that runs once after all tests
});

beforeEach(async () => {
  // Reset code that runs before each test
});
