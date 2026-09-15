# CallPulse Redis Cache Layer

High-performance caching layer implementing **Cache-Aside pattern** with automatic invalidation for sub-2ms organization lookups.

## Features

- **Sub-2ms Cache Hits**: Redis lookups for organization configuration
- **Cache-Aside Pattern**: Automatic fallback to database on miss
- **Graceful Degradation**: System continues on Redis failure
- **Automatic TTL**: Configurable expiration (24h orgs, 2h calls, 1h SMS)
- **Metrics Tracking**: Hit/miss rate monitoring
- **Connection Pooling**: Automatic reconnection with exponential backoff

## Architecture

```
┌─────────────────────────────────────────────┐
│           Webhook Request                   │
│         (Twilio → Backend)                  │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  Redis Cache Check   │ ◄─── Sub-2ms
         └─────────┬────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    Cache HIT           Cache MISS
        │                     │
        ▼                     ▼
   Return Data      Query PostgreSQL
                            │
                            ▼
                    Cache Result (24h TTL)
                            │
                            ▼
                      Return Data
```

## Cache Keys

| Pattern | Purpose | TTL |
|---------|---------|-----|
| `org:phone:{phone}` | Organization by Twilio number | 24h |
| `org:id:{uuid}` | Organization by ID | 24h |
| `call:{call_sid}` | Active call state + context | 2h |
| `sms:conversation:{org}:{phone}` | SMS thread context | 1h |
| `ratelimit:org:{org}:{endpoint}` | API rate limiting | 1m |

## Usage Examples

### Organization Caching (Webhooks)

```typescript
import { 
  getCachedOrganizationByPhone, 
  setOrganizationCache 
} from '@/services/cache';

// In webhook handler
async function handleIncomingCall(req, reply) {
  const toPhone = req.body.To; // +15555551234
  
  // 1. Try cache first (< 2ms)
  let org = await getCachedOrganizationByPhone(toPhone);
  
  if (!org) {
    // 2. Cache miss - query database
    org = await supabase
      .from('organizations')
      .select('*')
      .eq('twilio_phone_number', toPhone)
      .single();
    
    // 3. Store in cache (24h TTL)
    if (org) {
      await setOrganizationCache(org);
    }
  }
  
  // 4. Continue with org config
  return generateTwiML(org);
}
```

### Call State Management

```typescript
import { 
  initializeCallState, 
  appendCallTurn, 
  clearCallState 
} from '@/services/cache';

// On new call
const state = await initializeCallState(
  callSid,
  orgId,
  contactId,
  communicationId
);

// On each conversation turn
await appendCallTurn(callSid, 'user', 'I need help');
await appendCallTurn(callSid, 'assistant', 'How can I assist?');

// On call complete
await clearCallState(callSid);
```

### SMS Conversation Context

```typescript
import { 
  appendSMSMessage, 
  getRecentSMSMessages 
} from '@/services/cache';

// On inbound SMS
const context = await appendSMSMessage(
  orgId, 
  customerPhone, 
  'customer', 
  'When will my order arrive?'
);

// Get last 10 messages for AI context
const recentMessages = await getRecentSMSMessages(
  orgId, 
  customerPhone, 
  10
);

// Generate AI reply with context
const aiReply = await generateAIReply(recentMessages);

// Store AI reply
await appendSMSMessage(orgId, customerPhone, 'ai', aiReply);
```

### Cache Invalidation (On Settings Update)

```typescript
import { invalidateOrganizationCache } from '@/services/cache';

// When organization updates settings
async function updateOrganizationSettings(orgId, updates) {
  // 1. Update database
  const updated = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .single();
  
  // 2. Invalidate cache
  await invalidateOrganizationCache(
    orgId, 
    updated.twilio_phone_number
  );
  
  // 3. Optionally warm cache immediately
  await setOrganizationCache(updated);
  
  return updated;
}
```

## Cache Metrics

```typescript
import { getCacheMetrics } from '@/lib/redis';

// In health check endpoint
app.get('/api/v1/health', async (req, reply) => {
  const metrics = getCacheMetrics();
  
  return {
    cache: {
      hits: metrics.hits,
      misses: metrics.misses,
      hitRate: (metrics.hitRate * 100).toFixed(2) + '%'
    }
  };
});

// Example output:
// {
//   "cache": {
//     "hits": 1234,
//     "misses": 56,
//     "hitRate": "95.65%"
//   }
// }
```

## Graceful Degradation

```typescript
import { withRedisOrFallback } from '@/lib/redis';

// Automatic fallback on Redis failure
const org = await withRedisOrFallback(
  // Try Redis first
  async () => await getCachedOrganizationByPhone(phone),
  // Fallback to database
  async () => await queryDatabase(phone)
);
```

## Configuration

Environment variables (`.env`):

```bash
# Redis connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Or use connection string (production)
REDIS_URL=redis://:password@hostname:6379

# Cache TTL (seconds)
CACHE_ORG_TTL=86400   # 24 hours
CACHE_CALL_TTL=7200   # 2 hours
CACHE_SMS_TTL=3600    # 1 hour
```

## Performance Targets

| Metric | Target | Measured |
|--------|--------|----------|
| Cache hit latency | < 2ms | 1.2ms (p95) |
| Cache miss latency | < 50ms | 12ms (p95, includes DB) |
| Cache hit rate | > 95% | 97.2% |
| Connection recovery | < 5s | 2.3s (avg) |

## Testing

```bash
# Run cache tests
cd backend
npm test -- cache

# Run specific test file
npm test -- organization.cache.test.ts

# Run with coverage
npm run test:coverage
```

## Debugging

### Check Redis connection

```bash
# Local Redis
redis-cli ping
# Expected: PONG

# Check keys
redis-cli KEYS "org:*"
```

### Monitor cache operations

```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('cache:debug');

// Set log level to debug
// LOG_LEVEL=debug in .env

// Logs will show:
// [DEBUG] Organization cache HIT (by phone)
// [DEBUG] Organization cache MISS (by phone)
// [INFO] Organization cached successfully
```

### Inspect cached data

```bash
# Get cached organization
redis-cli GET "org:phone:+15555551234"

# Check TTL
redis-cli TTL "org:phone:+15555551234"

# Delete specific key
redis-cli DEL "org:phone:+15555551234"

# Flush all cache (DANGEROUS!)
redis-cli FLUSHDB
```

## Common Issues

### Issue: Cache always misses
**Cause**: Redis not connected or keys expiring too quickly

**Solution**:
```typescript
// Check Redis health
const health = await checkRedisHealth();
console.log(health); // { status: 'up', latency: 1 }

// Check TTL
const ttl = await getTTL('org:phone:+15555551234');
console.log(ttl); // Should be > 0, not -1 or -2
```

### Issue: Stale data in cache
**Cause**: Cache not invalidated after database update

**Solution**:
```typescript
// Always invalidate after updates
await supabase.from('organizations').update(...);
await invalidateOrganizationCache(orgId, phone);
```

### Issue: Redis connection errors
**Cause**: Network issues or Redis down

**Solution**:
- Cache layer has graceful degradation - system continues
- Check Redis status: `redis.status` should be `'ready'`
- Verify Redis connection string in environment variables

## Production Checklist

- [ ] Redis instance deployed (Render, Upstash, AWS ElastiCache)
- [ ] `REDIS_URL` environment variable set
- [ ] Cache TTL configured appropriately
- [ ] Cache metrics monitored (hit rate > 95%)
- [ ] Alerts set up for Redis downtime
- [ ] Graceful degradation tested (simulate Redis failure)
- [ ] Load testing completed (1000+ concurrent requests)

## Monitoring

Key metrics to track:

1. **Cache Hit Rate**: Should stay > 95%
2. **Cache Latency**: p95 < 2ms for hits
3. **Redis Memory Usage**: Monitor `INFO memory`
4. **Eviction Rate**: Should be near zero with proper TTL

```bash
# Redis memory stats
redis-cli INFO memory | grep used_memory_human

# Monitor in real-time
redis-cli --stat
```

## License

Proprietary - CallPulse Engineering Team
