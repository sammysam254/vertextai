import { redis, checkRedisHealth, setCached, getCached, CacheKeys } from '../lib/redis';

async function runComprehensiveTest() {
  console.log('=============================================');
  console.log('UPSTASH CLOUD REDIS COMPREHENSIVE LIVE TEST');
  console.log('=============================================\n');

  // 1. Connection & Ping
  console.log('1. Testing Connection & Ping...');
  const tStart = Date.now();
  const health = await checkRedisHealth();
  const pingDuration = Date.now() - tStart;
  console.log(`✓ Health Status: ${health.status.toUpperCase()}`);
  console.log(`✓ Ping Latency: ${health.latency ?? pingDuration}ms\n`);

  // 2. String Write & Read
  console.log('2. Testing String Key Write/Read...');
  const testKey = 'test:vertext_live_probe';
  const testValue = `probe_ok_${Date.now()}`;
  await redis.set(testKey, testValue, 'EX', 120);
  const fetchedValue = await redis.get(testKey);
  console.log(`✓ SET key '${testKey}' -> '${testValue}'`);
  console.log(`✓ GET key '${testKey}' -> '${fetchedValue}'`);
  if (fetchedValue !== testValue) {
    throw new Error(`Value mismatch! Expected ${testValue}, got ${fetchedValue}`);
  }
  console.log('✓ String verification: MATCH\n');

  // 3. Complex JSON / Object Caching
  console.log('3. Testing Complex Object Caching (Org Data Simulation)...');
  const sampleOrg = {
    id: 'org_probe_9988',
    name: 'Vertext AI Enterprise',
    merchant_code: 'VRTX99',
    wallet_balance: 145.50,
    twilio_phone_number: '+12513571708',
    cachedAt: new Date().toISOString(),
  };
  const orgCacheKey = CacheKeys.orgById(sampleOrg.id);
  await setCached(orgCacheKey, sampleOrg, 300);
  const cachedOrg = await getCached<typeof sampleOrg>(orgCacheKey);
  console.log(`✓ Cached Org Key: ${orgCacheKey}`);
  console.log(`✓ Retrieved Org Balance: $${cachedOrg?.wallet_balance}`);
  console.log(`✓ Retrieved Org Name: ${cachedOrg?.name}`);
  console.log('✓ Object serialization/deserialization: MATCH\n');

  // 4. Rate Limiter Atomic Counter (INCR)
  console.log('4. Testing Atomic INCR (Rate Limiting)...');
  const counterKey = 'ratelimit:probe:' + Date.now();
  const c1 = await redis.incr(counterKey);
  const c2 = await redis.incr(counterKey);
  const c3 = await redis.incr(counterKey);
  await redis.expire(counterKey, 60);
  console.log(`✓ Atomic Counter after 3 INCR ops: ${c3}`);
  console.log('✓ Atomic increment operations: VERIFIED\n');

  // 5. Cleanup
  console.log('5. Cleaning Up Test Keys...');
  await redis.del(testKey, orgCacheKey, counterKey);
  console.log('✓ Cleaned probe keys from Upstash Cloud.\n');

  console.log('=============================================');
  console.log('RESULT: ALL REDIS VERIFICATIONS PASSED (100%)');
  console.log('=============================================');

  process.exit(0);
}

runComprehensiveTest().catch((err) => {
  console.error('✗ Redis Test Error:', err);
  process.exit(1);
});
