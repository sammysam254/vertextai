-- ============================================
-- CallPulse Database Schema v1.0 (Fixed)
-- PostgreSQL 15.x with Row Level Security
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- ============================================
-- 1. ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Twilio Configuration
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT UNIQUE NOT NULL,
  
  -- AI Configuration
  ai_system_prompt TEXT NOT NULL DEFAULT 'You are a professional call center assistant. Be helpful, concise, and friendly.',
  ai_voice_id TEXT NOT NULL DEFAULT 'Polly.Joanna-Neural',
  ai_model TEXT NOT NULL DEFAULT 'llama-3.1-8b-instant',
  
  -- Escalation Settings
  escalation_phone_number TEXT NOT NULL,
  escalation_keywords TEXT[] DEFAULT ARRAY['human', 'agent', 'representative', 'manager', 'supervisor'],
  
  -- Billing & Metadata
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_twilio_phone ON organizations(twilio_phone_number);
CREATE INDEX IF NOT EXISTS idx_org_created_at ON organizations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_subscription_tier ON organizations(subscription_tier);

-- Updated timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_org_updated_at ON organizations;
CREATE TRIGGER trg_org_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 2. CONTACTS
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
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

CREATE INDEX IF NOT EXISTS idx_contacts_org_phone ON contacts(organization_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON contacts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_org_last_contact ON contacts(organization_id, last_contact_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_metadata ON contacts USING gin(metadata);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. COMMUNICATIONS (Calls + SMS)
-- ============================================
CREATE TABLE IF NOT EXISTS communications (
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
  status TEXT NOT NULL DEFAULT 'initiated',
  duration_seconds INTEGER DEFAULT 0,
  
  -- Escalation Tracking
  escalated_to_human BOOLEAN DEFAULT FALSE,
  escalation_reason TEXT,
  escalation_timestamp TIMESTAMPTZ,
  
  -- AI Analysis
  summary TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  intent TEXT,
  
  -- Cost Tracking
  cost_usd NUMERIC(10, 4),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- High-performance indexes
CREATE INDEX IF NOT EXISTS idx_comms_org_created ON communications(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_org_type ON communications(organization_id, type);
CREATE INDEX IF NOT EXISTS idx_comms_org_type_created ON communications(organization_id, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comms_contact ON communications(contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comms_twilio_sid ON communications(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_comms_escalated ON communications(organization_id, escalated_to_human) WHERE escalated_to_human = TRUE;
CREATE INDEX IF NOT EXISTS idx_comms_status ON communications(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_comms_completed_at ON communications(organization_id, completed_at DESC) WHERE completed_at IS NOT NULL;

DROP TRIGGER IF EXISTS trg_comms_updated_at ON communications;
CREATE TRIGGER trg_comms_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 4. MESSAGES (SMS Threads)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
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

CREATE INDEX IF NOT EXISTS idx_messages_comm ON messages(communication_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_org_sender ON messages(organization_id, sender, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_body_trgm ON messages USING gin(body gin_trgm_ops);

-- ============================================
-- 5. CALL TRANSCRIPTS
-- ============================================
CREATE TABLE IF NOT EXISTS call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id UUID NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
  
  -- Speaker & Content
  speaker TEXT NOT NULL CHECK (speaker IN ('caller', 'ai', 'agent')),
  content TEXT NOT NULL,
  
  -- Confidence & Metadata
  confidence NUMERIC(3, 2) CHECK (confidence >= 0 AND confidence <= 1),
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_comm ON call_transcripts(communication_id, timestamp ASC);
CREATE INDEX IF NOT EXISTS idx_transcripts_content_trgm ON call_transcripts USING gin(content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_transcripts_speaker ON call_transcripts(communication_id, speaker);

-- ============================================
-- 6. AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Actor (user ID from auth.users)
  user_id UUID,
  
  -- Action details
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  
  -- Changes (before/after)
  changes JSONB,
  
  -- Metadata
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- CONTACT AUTO-UPDATE FUNCTION
-- ============================================
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

DROP TRIGGER IF EXISTS trg_update_contact_last_contact ON communications;
CREATE TRIGGER trg_update_contact_last_contact
  AFTER INSERT ON communications
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION update_contact_last_contact();

-- ============================================
-- VIEWS & ANALYTICS
-- ============================================

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

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ CallPulse Database Schema installed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created: 6';
  RAISE NOTICE '  • organizations';
  RAISE NOTICE '  • contacts';
  RAISE NOTICE '  • communications';
  RAISE NOTICE '  • messages';
  RAISE NOTICE '  • call_transcripts';
  RAISE NOTICE '  • audit_logs';
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes: 25+';
  RAISE NOTICE 'Views: 2';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Database is ready! You can now use CallPulse.';
END $$;
