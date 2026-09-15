# CallPulse Supabase Database Setup

Complete database schema and migration files for CallPulse AI Call Center platform.

## Files

- **`001_initial_schema.sql`**: Complete database schema with tables, indexes, RLS policies
- **`002_rollback_initial_schema.sql`**: Rollback script (use with caution!)
- **`seed.sql`**: Sample data for development/testing

## Quick Start

### Option 1: Supabase Cloud (Recommended)

1. Create a new Supabase project at https://supabase.com

2. Go to **SQL Editor** in your Supabase dashboard

3. Copy and paste the contents of `001_initial_schema.sql`

4. Click **Run** to execute the migration

5. Verify success in the **Table Editor** (you should see 6 tables)

6. **(Optional)** Load seed data:
   - Copy contents of `seed.sql`
   - Paste in SQL Editor
   - Click **Run**

### Option 2: Supabase CLI (Local Development)

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize Supabase locally
supabase init

# Start local Supabase stack (PostgreSQL, Auth, Storage, etc.)
supabase start

# Run migrations
supabase db push

# Load seed data (optional)
psql postgresql://postgres:postgres@localhost:54322/postgres < supabase/seed.sql
```

## Database Schema Overview

### Tables

| Table | Purpose | Row Count (seed) |
|-------|---------|------------------|
| **organizations** | Tenant/organization configuration | 3 |
| **organization_members** | RBAC for users | 0 (manual) |
| **contacts** | Customer contact directory | 6 |
| **communications** | All calls + SMS | 5 |
| **messages** | SMS message threads | 5 |
| **call_transcripts** | Voice call transcripts | 10 |

### Key Features

- **Row Level Security (RLS)**: Complete multi-tenant isolation
- **Service Role Bypass**: Webhooks can write without user auth
- **Full-Text Search**: GIN indexes on transcripts and messages
- **Automatic Timestamps**: `updated_at` triggers on all tables
- **Contact Auto-Update**: `last_contact_at` updates on new communications

## Indexes

**25+ indexes** for high-performance queries:
- Composite indexes on `(organization_id, created_at DESC)`
- Unique indexes on lookup keys (`twilio_phone_number`, `twilio_sid`)
- GIN indexes for full-text search (`pg_trgm`)
- Partial indexes for filtered queries (e.g., `WHERE escalated_to_human = TRUE`)

## Row Level Security (RLS)

### Authenticated Users
Users can only access data from organizations they belong to:

```sql
-- Example: User queries contacts
SELECT * FROM contacts;
-- RLS automatically filters to: WHERE organization_id IN (user's orgs)
```

### Service Role (Webhooks)
Twilio webhooks use `service_role` key to bypass RLS:

```typescript
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// Can insert/update any organization's data
```

## Adding Users

After running migrations, you need to:

1. **Create users** via Supabase Auth UI or API
2. **Link users to organizations** via `organization_members` table

```sql
-- Example: Add user to organization
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Acme Corp ID
  'user-uuid-from-auth-users',
  'admin'
);
```

## Verifying Installation

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- Check indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Check RLS policies
SELECT tablename, policyname, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public';

-- Test organization stats view
SELECT * FROM organization_stats;
```

## Common Queries

### Get organization by phone number
```sql
SELECT * FROM organizations 
WHERE twilio_phone_number = '+15555551234';
```

### List recent calls for an organization
```sql
SELECT * FROM communications 
WHERE organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  AND type LIKE 'voice%'
ORDER BY created_at DESC 
LIMIT 50;
```

### Get full call transcript
```sql
SELECT speaker, content, timestamp
FROM call_transcripts
WHERE communication_id = 'comm-uuid'
ORDER BY timestamp ASC;
```

### Search messages by content
```sql
SELECT * FROM messages
WHERE organization_id = 'org-uuid'
  AND body ILIKE '%tracking%'
ORDER BY created_at DESC;
```

## Rollback

**WARNING**: This will delete ALL data!

```sql
-- In Supabase SQL Editor, run:
-- Copy contents of 002_rollback_initial_schema.sql
```

Or via CLI:
```bash
supabase db reset
```

## Performance Tuning

### Check query performance
```sql
EXPLAIN ANALYZE
SELECT * FROM communications 
WHERE organization_id = 'xxx' 
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

Should show:
- `Index Scan` (not `Seq Scan`)
- Execution time < 50ms

### Analyze table statistics
```sql
ANALYZE communications;
ANALYZE contacts;
```

## Maintenance

### Update statistics (weekly)
```sql
VACUUM ANALYZE;
```

### Check database size
```sql
SELECT 
  pg_size_pretty(pg_database_size('postgres')) AS db_size,
  pg_size_pretty(pg_total_relation_size('communications')) AS comms_size,
  pg_size_pretty(pg_total_relation_size('call_transcripts')) AS transcripts_size;
```

## Backup & Restore

### Supabase Cloud
Automatic daily backups (retention varies by plan)

### Manual Backup (Local)
```bash
pg_dump -h localhost -p 54322 -U postgres postgres > backup.sql
```

### Restore
```bash
psql -h localhost -p 54322 -U postgres postgres < backup.sql
```

## Troubleshooting

### Issue: RLS blocking legitimate queries
**Solution**: Verify user is linked in `organization_members`

```sql
-- Check user's organizations
SELECT * FROM auth.user_organizations();
```

### Issue: Service role can't write
**Solution**: Ensure using `service_role` key, not `anon` key

```typescript
// Correct
const supabase = createClient(URL, SERVICE_ROLE_KEY);

// Wrong (will be blocked by RLS)
const supabase = createClient(URL, ANON_KEY);
```

### Issue: Slow queries
**Solution**: Check indexes are being used

```sql
-- Look for "Seq Scan" (bad) vs "Index Scan" (good)
EXPLAIN ANALYZE SELECT ...;
```

## Production Checklist

- [ ] Run `001_initial_schema.sql` successfully
- [ ] Verify 6 tables created
- [ ] Verify 25+ indexes created
- [ ] Verify RLS policies enabled
- [ ] Create at least one organization
- [ ] Link users to organizations
- [ ] Test authenticated queries (RLS filtering works)
- [ ] Test service role queries (bypass RLS)
- [ ] Set up scheduled VACUUM ANALYZE (weekly)
- [ ] Configure automated backups

## Support

For schema issues or questions:
- Check existing tables: Supabase Dashboard → Table Editor
- View RLS policies: Supabase Dashboard → Authentication → Policies
- Test queries: Supabase Dashboard → SQL Editor

## License

Proprietary - CallPulse Engineering Team
