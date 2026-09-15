-- ============================================
-- Migration 003 — Complete & Self-Contained
-- Safe to re-run (all statements idempotent)
-- ============================================

-- ============================================
-- 1. TRIGGER HELPER
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. ORGANIZATION_MEMBERS TABLE
--    (must exist before get_user_organizations)
-- ============================================

CREATE TABLE IF NOT EXISTS organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('owner','admin','agent')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org  ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_role ON organization_members(organization_id, role);

-- ============================================
-- 3. RLS HELPER FUNCTION
--    (created AFTER the table it queries)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 4. RLS ON ORGANIZATION_MEMBERS
-- ============================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own org members"            ON organization_members;
DROP POLICY IF EXISTS "Service role full access to org members" ON organization_members;

CREATE POLICY "Users access own org members"
  ON organization_members FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service role full access to org members"
  ON organization_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- 5. AGENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name         TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  email        TEXT,

  status    TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('available','in_call','busy','offline')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status_change_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_agents_org        ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_org_phone  ON agents(organization_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_agents_org_status ON agents(organization_id, status)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_agents_user       ON agents(user_id)
  WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_agents_updated_at ON agents;
CREATE TRIGGER trg_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.update_agent_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.last_status_change_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agents_status_change ON agents;
CREATE TRIGGER trg_agents_status_change
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION public.update_agent_status_timestamp();

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users access own org agents"        ON agents;
DROP POLICY IF EXISTS "Service role full access to agents" ON agents;

CREATE POLICY "Users access own org agents"
  ON agents FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Service role full access to agents"
  ON agents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- 6. TRANSFER COLUMNS ON COMMUNICATIONS
-- ============================================

ALTER TABLE communications
  ADD COLUMN IF NOT EXISTS transferred_to_agent_id UUID
    REFERENCES agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transferred_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT
    CHECK (transfer_status IN ('pending','completed','failed','busy','no_answer'));

CREATE INDEX IF NOT EXISTS idx_comms_transferred
  ON communications(organization_id, transferred_to_agent_id)
  WHERE transferred_to_agent_id IS NOT NULL;

-- ============================================
-- 7. PATCH RLS ON ALL EXISTING TABLES
-- ============================================

-- Organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own organizations"                ON organizations;
DROP POLICY IF EXISTS "Service role has full access to organizations" ON organizations;
DROP POLICY IF EXISTS "Service role full access to organizations"     ON organizations;
CREATE POLICY "Users access own organizations"
  ON organizations FOR ALL TO authenticated
  USING (id IN (SELECT public.get_user_organizations()));
CREATE POLICY "Service role full access to organizations"
  ON organizations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own org contacts"            ON contacts;
DROP POLICY IF EXISTS "Service role has full access to contacts" ON contacts;
DROP POLICY IF EXISTS "Service role full access to contacts"     ON contacts;
CREATE POLICY "Users access own org contacts"
  ON contacts FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));
CREATE POLICY "Service role full access to contacts"
  ON contacts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Communications
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own org communications"            ON communications;
DROP POLICY IF EXISTS "Service role has full access to communications" ON communications;
DROP POLICY IF EXISTS "Service role full access to communications"     ON communications;
CREATE POLICY "Users access own org communications"
  ON communications FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));
CREATE POLICY "Service role full access to communications"
  ON communications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own org messages"            ON messages;
DROP POLICY IF EXISTS "Service role has full access to messages" ON messages;
DROP POLICY IF EXISTS "Service role full access to messages"     ON messages;
CREATE POLICY "Users access own org messages"
  ON messages FOR ALL TO authenticated
  USING (organization_id IN (SELECT public.get_user_organizations()));
CREATE POLICY "Service role full access to messages"
  ON messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Call Transcripts
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users access own org transcripts"                 ON call_transcripts;
DROP POLICY IF EXISTS "Service role has full access to call_transcripts" ON call_transcripts;
DROP POLICY IF EXISTS "Service role full access to call_transcripts"     ON call_transcripts;
CREATE POLICY "Users access own org transcripts"
  ON call_transcripts FOR ALL TO authenticated
  USING (
    communication_id IN (
      SELECT id FROM communications
      WHERE organization_id IN (SELECT public.get_user_organizations())
    )
  );
CREATE POLICY "Service role full access to call_transcripts"
  ON call_transcripts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- 8. AVAILABLE AGENTS VIEW
-- ============================================

CREATE OR REPLACE VIEW available_agents AS
SELECT
  a.id,
  a.organization_id,
  a.name,
  a.phone_number,
  a.status,
  a.last_status_change_at,
  COUNT(c.id) FILTER (
    WHERE c.status IN ('in-progress','ringing')
      AND c.created_at > NOW() - INTERVAL '24 hours'
  ) AS active_calls_today
FROM agents a
LEFT JOIN communications c ON c.transferred_to_agent_id = a.id
WHERE a.is_active = TRUE
GROUP BY
  a.id,
  a.organization_id,
  a.name,
  a.phone_number,
  a.status,
  a.last_status_change_at;

-- ============================================
-- DONE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 003 applied successfully.';
  RAISE NOTICE '   organization_members            — ready';
  RAISE NOTICE '   public.get_user_organizations() — ready';
  RAISE NOTICE '   agents                          — ready';
  RAISE NOTICE '   communications transfer columns — ready';
  RAISE NOTICE '   RLS policies (all tables)       — patched';
  RAISE NOTICE '   available_agents view           — ready';
END $$;
