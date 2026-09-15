-- ============================================
-- Rollback Script for 001_initial_schema.sql
-- USE WITH CAUTION - This will drop all tables
-- ============================================

-- Drop views first (depend on tables)
DROP VIEW IF EXISTS recent_communications;
DROP VIEW IF EXISTS organization_stats;

-- Drop triggers
DROP TRIGGER IF EXISTS trg_update_contact_last_contact ON communications;
DROP TRIGGER IF EXISTS trg_comms_updated_at ON communications;
DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS trg_org_updated_at ON organizations;

-- Drop functions
DROP FUNCTION IF EXISTS update_contact_last_contact();
DROP FUNCTION IF EXISTS auth.user_organizations();
DROP FUNCTION IF EXISTS update_updated_at();

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS call_transcripts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS communications CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Drop extensions (optional - only if not used by other schemas)
-- DROP EXTENSION IF EXISTS "pg_trgm";
-- DROP EXTENSION IF EXISTS "uuid-ossp";

-- Verify rollback
DO $$
BEGIN
  RAISE NOTICE 'CallPulse Database Schema rollback completed.';
  RAISE NOTICE 'All tables, views, functions, and triggers have been dropped.';
END $$;
