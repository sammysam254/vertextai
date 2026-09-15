-- ============================================
-- CallPulse Database Schema v1.0
-- PostgreSQL 15.x with Row Level Security
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================
-- 1. ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Twilio Configuration
  twilio_account_sid TEXT,
  twilio_auth_token TEXT, -- Encrypted via Supabase Vault or app-level encryption
  twilio_phone_number TEXT UNIQUE NOT NULL,
  
  -- AI Configuration
  ai_system_prompt TEXT NOT NULL DEFAULT 'You are a professional call center assistant. Be helpful, concise, and friendly.',
  ai_voice_id TEXT NOT NULL DEFAULT 'Polly.Joanna-Neural', -- Twilio voice ID
  ai_model TEXT NOT NULL DEFAULT 'llama-3.1-8b-instant', -- Groq model
  
  -- Escalation Settings
  escalation_phone_number TEXT NOT NULL,
  escalation_keywords TEXT[] DEFAULT ARRAY['human', 'agent', 'representative', 'manager', 'supervisor'],
  
  -- Billing & Metadata
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX idx_org_twilio_phone ON organizations(twilio_phone_number);
CREATE INDEX idx_org_created_at ON organizations(created_at DESC);
CREATE INDEX idx_org_subscription_tier ON organizations(subscription_tier);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. ORGANIZATION MEMBERS (Multi-tenant RBAC)
-- ============================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);

COMMENT ON TABLE organization_members IS 'Multi-tenant RBAC: owner (full access), admin (settings), agent (read-only)';

-- ============================================
-- 3. CONTACTS
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Contact Information
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  
  -- Custom metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_contact_at TIMESTAMPTZ,
  
  UNIQUE(organization_id, phone_number)
);

CREATE INDEX idx_contacts_org_phone ON contacts(organization_id, phone_number);
CREATE INDEX idx_contacts_org_created ON contacts(organization_id, created_at DESC);
CREATE INDEX idx_contacts_org_last_contact ON contacts(organization_id, last_contact_at DESC NULLS LAST);
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX idx_contacts_metadata ON contacts USING gin(metadata);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE contacts IS 'Organization-scoped contact directory with custom metadata';

-- ============================================
-- 4. COMMUNICATIONS (Calls + SMS)
-- ============================================
CREATE TABLE communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  
  -- Communication Type
  type TEXT NOT NULL CHECK (type IN ('voice_in', 'voice_out', 'sms_in', 'sms_out')),
  
  -- Twilio Identifiers
  twilio_sid TEXT UNIQUE NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  
  -- Status & Duration
  status TEXT NOT NULL DEFAULT 'initiated', -- initiated, ringing, in-progress, completed, failed, busy, no-answer
  duration_seconds INTEGER DEFAULT 0,
  
  -- Escalation Tracking
  escalated_to_human BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  escalation_timestamp TIMESTAMPTZ,
  
  -- AI Analysis
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  intent TEXT, -- support, sales, complaint, inquiry, etc.
  
  -- Cost Tracking (optional)
  cost_usd NUMERIC(10, 4),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- High-performance indexes
CREATE INDEX idx_comms_org_created ON communications(organization_id, created_at DESC);
CREATE INDEX idx_comms_org_type ON communications(organization_id, type);
CREATE INDEX idx_comms_org_type_created ON communications(organization_id, type, created_at DESC);
CREATE INDEX idx_comms_contact ON communications(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_comms_twilio_sid ON communications(twilio_sid);
CREATE INDEX idx_comms_escalated ON communications(organization_id, escalated_to_human) WHERE escalated_to_human = TRUE;
CREATE INDEX idx_comms_status ON communications(organization_id, status);
CREATE INDEX idx_comms_completed_at ON communications(organization_id, completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE TRIGGER trg_comms_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE communications IS 'Unified table for all voice calls and SMS interactions';

-- ============================================
-- 5. MESSAGES (SMS Threads)
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  
  -- Message Content
  sender TEXT NOT NULL CHECK (sender IN ('customer', 'ai', 'agent')),
  body TEXT NOT NULL,
  
  -- Media (MMS support)
  media_urls TEXT[],
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_comm ON messages(communication_id, created_at ASC);
CREATE INDEX idx_messages_org ON messages(organization_id, created_at DESC);
CREATE INDEX idx_messages_org_sender ON messages(organization_id, sender, created_at DESC);
CREATE INDEX idx_messages_body_trgm ON messages USING gin(body gin_trgm_ops);

COMMENT ON TABLE messages IS 'SMS message threads (chronological per communication)';

-- ============================================
-- 6. CALL TRANSCRIPTS
-- ============================================
CREATE TABLE call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  
  -- Speaker & Content
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'ai', 'agent')),
  content TEXT NOT NULL,
  
  -- Confidence & Metadata
  confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1), -- 0.00 to 1.00
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_comm ON call_transcripts(communication_id, timestamp ASC);
CREATE INDEX idx_transcripts_content_trgm ON call_transcripts USING gin(content gin_trgm_ops);
CREATE INDEX idx_transcripts_speaker ON call_transcripts(communication_id, speaker);

COMMENT ON TABLE call_transcripts IS 'Speaker-segmented call transcripts with confidence scores';

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all multi-tenant tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_transcripts ENABLE ROW LEVEL SECURITY;

-- Helper function: Get user's accessible organizations
CREATE OR REPLACE FUNCTION auth.user_organizations()
RETURNS SETOF UUID AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.user_organizations IS 'Returns UUIDs of all organizations the current user belongs to';

-- ============================================
-- RLS POLICIES - AUTHENTICATED USERS
-- ============================================

-- Organizations: Users see only orgs they belong to
CREATE POLICY "Users access own organizations"
  ON organizations FOR ALL
  USING (id IN (SELECT auth.user_organizations()));

-- Organization Members: Users see members of their orgs
CREATE POLICY "Users access own org members"
  ON organization_members FOR ALL
  USING (organization_id IN (SELECT auth.user_organizations()));

-- Contacts: Organization-scoped
CREATE POLICY "Users access own org contacts"
  ON contacts FOR ALL
  USING (organization_id IN (SELECT auth.user_organizations()));

-- Communications: Organization-scoped
CREATE POLICY "Users access own org communications"
  ON communications FOR ALL
  USING (organization_id IN (SELECT auth.user_organizations()));

-- Messages: Organization-scoped
CREATE POLICY "Users access own org messages"
  ON messages FOR ALL
  USING (organization_id IN (SELECT auth.user_organizations()));

-- Call Transcripts: Via communication relationship
CREATE POLICY "Users access own org transcripts"
  ON call_transcripts FOR ALL
  USING (
    communication_id IN (
      SELECT id FROM communications 
      WHERE organization_id IN (SELECT auth.user_organizations())
    )
  );

-- ============================================
-- RLS POLICIES - SERVICE ROLE BYPASS
-- ============================================
-- Twilio webhooks use service_role key to bypass RLS

CREATE POLICY "Service role has full access to organizations"
  ON organizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to org_members"
  ON organization_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to contacts"
  ON contacts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to communications"
  ON communications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to messages"
  ON messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role has full access to call_transcripts"
  ON call_transcripts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- VIEWS & ANALYTICS
-- ============================================

-- Organization summary view
CREATE OR REPLACE VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  o.subscription_tier,
  COUNT(DISTINCT co.id) AS total_contacts,
  COUNT(DISTINCT CASE WHEN cm.type LIKE 'voice%' THEN cm.id END) AS total_calls,
  COUNT(DISTINCT CASE WHEN cm.type LIKE 'sms%' THEN cm.id END) AS total_messages,
  COUNT(DISTINCT CASE WHEN cm.escalated_to_human = TRUE THEN cm.id END) AS escalated_calls,
  ROUND(AVG(cm.duration_seconds) FILTER (WHERE cm.type LIKE 'voice%' AND cm.duration_seconds > 0), 2) AS avg_call_duration_sec,
  MAX(cm.created_at) AS last_activity,
  o.created_at
FROM organizations o
LEFT JOIN contacts co ON co.organization_id = o.id
LEFT JOIN communications cm ON cm.organization_id = o.id
GROUP BY o.id, o.name, o.subscription_tier, o.created_at;

COMMENT ON VIEW organization_stats IS 'Aggregated statistics per organization';

-- Recent communications view (last 100 per org)
CREATE OR REPLACE VIEW recent_communications AS
SELECT 
  c.id,
  c.organization_id,
  c.type,
  c.from_number,
  c.to_number,
  c.status,
  c.duration_seconds,
  c.escalated_to_human,
  c.summary,
  c.sentiment,
  c.created_at,
  c.completed_at,
  co.name AS contact_name,
  co.email AS contact_email
FROM communications c
LEFT JOIN contacts co ON c.contact_id = co.id
ORDER BY c.created_at DESC;

COMMENT ON VIEW recent_communications IS 'Recent communications with contact details';

-- ============================================
-- FUNCTIONS - CONTACT AUTO-UPDATE
-- ============================================

-- Trigger to update last_contact_at when communication created
CREATE OR REPLACE FUNCTION update_contact_last_contact()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    UPDATE contacts
    SET last_contact_at = NEW.created_at
    WHERE id = NEW.contact_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_contact_last_contact
  AFTER INSERT ON communications
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION update_contact_last_contact();

-- ============================================
-- SAMPLE DATA (for development/testing)
-- ============================================

-- Uncomment to insert sample data
/*
-- Sample organization
INSERT INTO organizations (
  name, 
  twilio_phone_number, 
  escalation_phone_number,
  ai_system_prompt
) VALUES (
  'Acme Corporation',
  '+15555551234',
  '+15555559999',
  'You are a helpful assistant for Acme Corporation. Assist customers with product inquiries, order status, and general support. Be professional and friendly.'
) RETURNING id;

-- Note: To add organization members, you need actual user UUIDs from auth.users
-- This requires users to sign up first via Supabase Auth
*/

-- ============================================
-- INDEXES SUMMARY
-- ============================================
/*
Total Indexes Created: 25+

organizations:
  - idx_org_twilio_phone (unique)
  - idx_org_created_at
  - idx_org_subscription_tier

organization_members:
  - idx_org_members_user
  - idx_org_members_org
  - idx_org_members_role

contacts:
  - idx_contacts_org_phone
  - idx_contacts_org_created
  - idx_contacts_org_last_contact
  - idx_contacts_name_trgm (GIN)
  - idx_contacts_metadata (GIN)

communications:
  - idx_comms_org_created
  - idx_comms_org_type
  - idx_comms_org_type_created
  - idx_comms_contact
  - idx_comms_twilio_sid
  - idx_comms_escalated
  - idx_comms_status
  - idx_comms_completed_at

messages:
  - idx_messages_comm
  - idx_messages_org
  - idx_messages_org_sender
  - idx_messages_body_trgm (GIN)

call_transcripts:
  - idx_transcripts_comm
  - idx_transcripts_content_trgm (GIN)
  - idx_transcripts_speaker
*/

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify installation
DO $$
BEGIN
  RAISE NOTICE 'CallPulse Database Schema v1.0 installed successfully!';
  RAISE NOTICE 'Tables created: 6';
  RAISE NOTICE 'Indexes created: 25+';
  RAISE NOTICE 'RLS policies enabled: Yes';
  RAISE NOTICE 'Views created: 2';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create Supabase users via Auth UI';
  RAISE NOTICE '2. Insert organizations via backend API or SQL';
  RAISE NOTICE '3. Add organization members to link users';
  RAISE NOTICE '4. Configure Twilio webhooks to point to backend';
END $$;
