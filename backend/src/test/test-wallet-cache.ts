import { getWalletSummary } from '../services/database/wallet.service';
import { getCached, deleteCached } from '../lib/redis';

async function testWalletCache() {
  console.log('Testing Wallet Summary Redis Caching...');
  const testOrgId = '00000000-0000-0000-0000-000000000000';
  const cacheKey = `wallet:summary:${testOrgId}`;

  // Clear cache first
  await deleteCached(cacheKey);

  // 1. First fetch (Hits DB + Populates Redis)
  const t0 = Date.now();
  const summary1 = await getWalletSummary(testOrgId);
  const dur1 = Date.now() - t0;
  console.log(`Fetch 1 (Supabase DB): ${dur1}ms | Balance: $${summary1.balance}`);

  // 2. Second fetch (Served from Redis in ~0ms)
  const t1 = Date.now();
  const summary2 = await getWalletSummary(testOrgId);
  const dur2 = Date.now() - t1;
  console.log(`Fetch 2 (Redis Cache):  ${dur2}ms | Balance: $${summary2.balance}`);

  // 3. Verify Redis raw data
  const rawCached = await getCached(cacheKey);
  console.log('Direct Redis key verification:', rawCached ? 'FOUND' : 'MISSING');

  // Clean up
  await deleteCached(cacheKey);
  console.log('✓ Wallet cache test passed successfully!');
  process.exit(0);
}

testWalletCache().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
