# CallPulse - System Design & Architecture
## Technical Design Document v1.0

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet / PSTN                          │
└────────────┬────────────────────────────────────┬────────────────┘
             │                                    │
             │ Voice/SMS                          │ HTTPS
             ▼                                    ▼
   ┌─────────────────────┐            ┌─────────────────────┐
   │   Twilio Platform   │            │   Next.js Frontend  │
   │  (Voice + Messaging)│            │   (Render Static)   │
   └──────────┬──────────┘            └──────────┬──────────┘
              │ Webhooks                          │ API Calls
              │ (TwiML)                           │
              ▼                                   ▼
   ┌──────────────────────────────────────────────────────────┐
   │         Fastify Backend (Render Web Service)             │
   │  ┌────────────────────────────────────────────────┐      │
   │  │  Voice Handler  │  SMS Handler  │  REST API    │      │
   │  │  (Turn-based)   │  (AI Reply)   │  (Internal)  │      │
   │  └────────────────────────────────────────────────┘      │
   │  ┌────────────────────────────────────────────────┐      │
   │  │  Redis Cache Layer (ioredis)                   │      │
   │  │  - Org config (24h TTL)                        │      │
   │  │  - Call state (2h TTL)                         │      │
   │  │  - SMS conversation context (1h TTL)           │      │
   │  └────────────────────────────────────────────────┘      │
   └───────────┬──────────────────────────┬───────────────────┘
               │                          │
               │ Queries                  │ AI Inference
               ▼                          ▼
   ┌─────────────────────┐    ┌─────────────────────┐
   │  Supabase PostgreSQL│    │    Groq API         │
   │  - Multi-tenant DB  │    │  (Llama 3 8B/70B)   │
   │  - RLS policies     │    │  Function calling   │
   │  - Connection pool  │    │  Streaming enabled  │
   └─────────────────────┘    └─────────────────────┘
               │
               │ Change streams
               ▼
   ┌─────────────────────┐
   │  Supabase Realtime  │
   │  (WebSocket updates)│
   └─────────────────────┘
```

### 1.2 Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | Server-rendered dashboard UI |
| **Backend** | Fastify 4.x + TypeScript | High-performance HTTP/WebSocket server |
| **Database** | Supabase PostgreSQL 15 | Multi-tenant data with RLS |
| **Cache** | Redis (Upstash/Render) | Sub-2ms config lookups, call state |
| **Telephony** | Twilio Voice + Messaging | PSTN connectivity, TwiML execution |
| **AI** | Groq API (Llama 3) | Zero-cost conversational inference |
| **TTS** | Twilio Polly Neural | Native TwiML `<Say>` voices |
| **Deployment** | Render.com | Managed PaaS with auto-scaling |

---

## 2. Database Schema Design

### 2.1 Entity-Relationship Diagram

```
┌─────────────────────┐
│   auth.users        │ (Supabase Auth)
└──────────┬──────────┘
           │
           │ user_id
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│ organization_members│◄────────│   organizations     │
│                     │         │  (PK: id)           │
│ PK: id              │         │  - name             │
│ FK: organization_id │         │  - twilio_*         │
│ FK: user_id         │         │  - ai_system_prompt │
│ - role              │         │  - escalation_phone │
└─────────────────────┘         └──────────┬──────────┘
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     │                     │                     │
                     ▼                     ▼                     ▼
         ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
         │     contacts        │ │  communications     │ │  (settings)         │
         │  PK: id             │ │  PK: id             │ └─────────────────────┘
         │  FK: organization_id│ │  FK: organization_id│
         │  - phone_number     │ │  FK: contact_id     │
         │  - name, email      │ │  - type (voice/sms) │
         │  - metadata (jsonb) │ │  - twilio_sid       │
         └──────────┬──────────┘ │  - status           │
                    │            │  - duration_seconds │
                    │            │  - escalated_to_*   │
                    │            │  - summary          │
                    │            └──────────┬──────────┘
                    │                       │
                    │                       │
                    │                       ├──────────────────┐
                    │                       │                  │
                    │                       ▼                  ▼
                    │          ┌─────────────────────┐ ┌─────────────────────┐
                    │          │     messages        │ │  call_transcripts   │
                    │          │  PK: id             │ │  PK: id             │
                    │          │  FK: communication  │ │  FK: communication  │
                    │          │  FK: organization   │ │  - speaker          │
                    │          │  - sender           │ │  - content          │
                    │          │  - body             │ │  - timestamp        │
                    │          │  - created_at       │ └─────────────────────┘
                    │          └─────────────────────┘
                    │
                    └─────► (implicit join on phone_number)
```

### 2.2 Complete SQL Schema

```sql
-- ============================================
-- CallPulse Database Schema v1.0
-- PostgreSQL 15.x with Row Level Security
-- ============================================

-- Enable UUID extension
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
  twilio_auth_token TEXT, -- Encrypted via Supabase Vault
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

-- Updated timestamp trigger
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
CREATE INDEX idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX idx_contacts_metadata ON contacts USING gin(metadata);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
  sentiment TEXT, -- positive, neutral, negative
  intent TEXT, -- support, sales, complaint, inquiry
  
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
CREATE INDEX idx_comms_contact ON communications(contact_id, created_at DESC);
CREATE INDEX idx_comms_twilio_sid ON communications(twilio_sid);
CREATE INDEX idx_comms_escalated ON communications(organization_id, escalated_to_human) WHERE escalated_to_human = TRUE;
CREATE INDEX idx_comms_status ON communications(organization_id, status);

CREATE TRIGGER trg_comms_updated_at
  BEFORE UPDATE ON communications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

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
CREATE INDEX idx_messages_body_trgm ON messages USING gin(body gin_trgm_ops);

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
  confidence NUMERIC(3, 2), -- 0.00 to 1.00
  
  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_comm ON call_transcripts(communication_id, timestamp ASC);
CREATE INDEX idx_transcripts_content_trgm ON call_transcripts USING gin(content gin_trgm_ops);

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
-- SERVICE ROLE BYPASS (for webhooks)
-- ============================================
-- Twilio webhooks use service_role key to bypass RLS

CREATE POLICY "Service role has full access to organizations"
  ON organizations FOR ALL
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
CREATE VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  COUNT(DISTINCT co.id) AS total_contacts,
  COUNT(DISTINCT cm.id) FILTER (WHERE cm.type LIKE 'voice%') AS total_calls,
  COUNT(DISTINCT cm.id) FILTER (WHERE cm.type LIKE 'sms%') AS total_messages,
  COUNT(DISTINCT cm.id) FILTER (WHERE cm.escalated_to_human = TRUE) AS escalated_calls,
  AVG(cm.duration_seconds) FILTER (WHERE cm.type LIKE 'voice%') AS avg_call_duration,
  MAX(cm.created_at) AS last_activity
FROM organizations o
LEFT JOIN contacts co ON co.organization_id = o.id
LEFT JOIN communications cm ON cm.organization_id = o.id
GROUP BY o.id, o.name;

-- ============================================
-- SAMPLE DATA (for development)
-- ============================================

-- Insert sample organization (development only)
-- INSERT INTO organizations (name, twilio_phone_number, escalation_phone_number)
-- VALUES ('Acme Corp', '+15555551234', '+15555559999')
-- RETURNING id;
```

---

## 3. Redis Caching Architecture

### 3.1 Cache Key Schema

```typescript
// Organization configuration (24h TTL)
`org:phone:${twilioPhoneNumber}` → JSON {
  orgId: string,
  name: string,
  twilioAccountSid: string,
  twilioAuthToken: string,
  aiSystemPrompt: string,
  aiVoiceId: string,
  escalationPhoneNumber: string,
  escalationKeywords: string[]
}

// Organization by ID (24h TTL)
`org:id:${organizationId}` → Same as above

// Active call state (2h TTL)
`call:${callSid}` → JSON {
  organizationId: string,
  contactId: string,
  communicationId: string,
  conversationContext: Array<{role: string, content: string}>,
  turnCount: number,
  startTime: number
}

// SMS conversation context (1h TTL)
`sms:conversation:${organizationId}:${contactPhone}` → JSON {
  messages: Array<{sender: string, body: string, timestamp: number}>,
  lastMessageAt: number
}

// Rate limiting (1min TTL)
`ratelimit:org:${organizationId}:${endpoint}` → number (request count)
```

### 3.2 Cache Invalidation Strategy

**Write-Through Pattern**:
```typescript
async function updateOrganizationConfig(orgId: string, updates: Partial<Organization>) {
  // 1. Update PostgreSQL
  const updated = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .single();
  
  // 2. Invalidate all org caches
  await redis.del(`org:id:${orgId}`);
  if (updated.twilio_phone_number) {
    await redis.del(`org:phone:${updated.twilio_phone_number}`);
  }
  
  // 3. Optionally, warm the cache immediately
  await warmOrganizationCache(orgId);
}
```

**Cache-Aside Pattern (Read)**:
```typescript
async function getOrganizationByPhone(phone: string): Promise<Organization> {
  // 1. Try Redis first
  const cached = await redis.get(`org:phone:${phone}`);
  if (cached) {
    metrics.increment('cache.hit');
    return JSON.parse(cached);
  }
  
  // 2. Cache miss - query database
  metrics.increment('cache.miss');
  const org = await supabase
    .from('organizations')
    .select('*')
    .eq('twilio_phone_number', phone)
    .single();
  
  // 3. Store in Redis with 24h TTL
  await redis.setex(`org:phone:${phone}`, 86400, JSON.stringify(org));
  
  return org;
}
```

### 3.3 Redis Configuration

```typescript
// config/redis.ts
import Redis from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  
  // Connection pool settings
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  
  // Reconnection settings
  reconnectOnError: (err) => {
    const targetError = 'READONLY';
    if (err.message.includes(targetError)) {
      return true; // Reconnect on READONLY error
    }
    return false;
  },
  
  // Command timeout
  commandTimeout: 5000,
  
  // Enable keep-alive
  keepAlive: 30000,
});

// Graceful degradation on Redis failure
redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
  // System continues with direct DB queries
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});
```

---

## 4. Turn-Based Voice Call Flow

### 4.1 Call Sequence Diagram

```
Customer              Twilio              Backend              Redis         Supabase        Groq API
   |                    |                    |                   |              |              |
   |--Call [+1555]----->|                    |                   |              |              |
   |                    |                    |                   |              |              |
   |                    |--POST /voice/in--->|                   |              |              |
   |                    |                    |                   |              |              |
   |                    |                    |---GET org:phone-->|              |              |
   |                    |                    |<--{org_config}----| (HIT <2ms)   |              |
   |                    |                    |                   |              |              |
   |                    |                    |---Create comm-----|------------->|              |
   |                    |                    |                   |              |              |
   |                    |<---TwiML <Gather>--|                   |              |              |
   |                    |    with greeting   |                   |              |              |
   |<--"Hello, how...---|                    |                   |              |              |
   |                    |                    |                   |              |              |
   |--"I need help"--->|                    |                   |              |              |
   |   (customer talks) |                    |                   |              |              |
   |                    |                    |                   |              |              |
   |                    |--POST /voice/turn->|                   |              |              |
   |                    | {SpeechResult}     |                   |              |              |
   |                    |                    |                   |              |              |
   |                    |                    |---Get context---->|              |              |
   |                    |                    |<--call state------| (2h TTL)     |              |
   |                    |                    |                   |              |              |
   |                    |                    |---Completion------|--------------|------------->|
   |                    |                    |<--AI reply--------|--------------|--------------|
   |                    |                    |                   |  (<300ms)    |              |
   |                    |                    |                   |              |              |
   |                    |                    |---Update state--->|              |              |
   |                    |                    |---Save transcript-|------------->|              |
   |                    |                    |                   |              |              |
   |                    |<---TwiML <Gather>--|                   |              |              |
   |                    |    with AI reply   |                   |              |              |
   |<--"I can help...---|                    |                   |              |              |
   |                    |                    |                   |              |              |
   |--"Transfer me"---->|                    |                   |              |              |
   |   (escalation)     |                    |                   |              |              |
   |                    |--POST /voice/turn->|                   |              |              |
   |                    | {SpeechResult}     |                   |              |              |
   |                    |                    |                   |              |              |
   |                    |                    |--Detect keyword---|              |              |
   |                    |                    |                   |              |              |
   |                    |<---TwiML <Dial>----|                   |              |              |
   |<--"Connecting...---|                    |                   |              |              |
   |                    |                    |                   |              |              |
   |--Connected to human agent------------->|                   |              |              |
```

### 4.2 TwiML Templates

**Initial Greeting** (`/api/v1/voice/incoming`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    action="https://api.callpulse.io/api/v1/voice/turn" 
    input="speech dtmf" 
    method="POST" 
    speechTimeout="auto"
    timeout="5"
    numDigits="1">
    <Say voice="Polly.Joanna-Neural">
      Hello, you've reached {{organization_name}}. How can I assist you today?
    </Say>
  </Gather>
  <!-- Fallback if silence -->
  <Redirect>https://api.callpulse.io/api/v1/voice/turn</Redirect>
</Response>
```

**Turn-Based Reply** (`/api/v1/voice/turn`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather 
    action="https://api.callpulse.io/api/v1/voice/turn" 
    input="speech dtmf" 
    method="POST" 
    speechTimeout="auto"
    timeout="5">
    <Say voice="{{voice_id}}">{{ai_generated_reply}}</Say>
  </Gather>
  <!-- If no response after 3 prompts, offer escalation -->
  {{#if should_prompt_escalation}}
  <Say>If you'd like to speak with a human agent, press 0 or say agent.</Say>
  {{/if}}
  <Redirect>https://api.callpulse.io/api/v1/voice/turn</Redirect>
</Response>
```

**Human Escalation**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="{{voice_id}}">
    Please hold while I connect you to an available agent.
  </Say>
  <Dial timeout="30" action="/api/v1/voice/dial-status">
    {{escalation_phone_number}}
  </Dial>
  <!-- Fallback if agent unavailable -->
  <Say>I'm sorry, all agents are currently busy. Please call back later or leave a message.</Say>
  <Hangup/>
</Response>
```

---

## 5. AI Conversation Engine

### 5.1 Groq API Integration

```typescript
// services/ai/groq.service.ts
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateAIReply(
  systemPrompt: string,
  conversationHistory: ConversationTurn[],
  userInput: string,
  escalationKeywords: string[]
): Promise<{ reply: string; shouldEscalate: boolean; reason?: string }> {
  
  const messages: ConversationTurn[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userInput }
  ];
  
  // Check for escalation keywords
  const lowerInput = userInput.toLowerCase();
  const detectedKeyword = escalationKeywords.find(kw => 
    lowerInput.includes(kw.toLowerCase())
  );
  
  if (detectedKeyword) {
    return {
      reply: "I understand you'd like to speak with a human agent. Let me connect you now.",
      shouldEscalate: true,
      reason: `Customer requested: "${detectedKeyword}"`
    };
  }
  
  // Call Groq API with function calling for escalation detection
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-70b-versatile', // or llama-3.1-8b-instant for faster response
    messages,
    temperature: 0.7,
    max_tokens: 150,
    stream: false,
    tools: [
      {
        type: 'function',
        function: {
          name: 'escalate_to_human',
          description: 'Transfer the customer to a human agent when the AI cannot help or customer is frustrated',
          parameters: {
            type: 'object',
            properties: {
              reason: {
                type: 'string',
                description: 'Brief reason for escalation'
              }
            },
            required: ['reason']
          }
        }
      }
    ]
  });
  
  const response = completion.choices[0];
  
  // Check if AI called escalation function
  if (response.message.tool_calls && response.message.tool_calls.length > 0) {
    const toolCall = response.message.tool_calls[0];
    if (toolCall.function.name === 'escalate_to_human') {
      const args = JSON.parse(toolCall.function.arguments);
      return {
        reply: "Let me connect you with someone who can better assist you.",
        shouldEscalate: true,
        reason: args.reason
      };
    }
  }
  
  // Normal AI response
  return {
    reply: response.message.content || "I'm here to help. Could you please repeat that?",
    shouldEscalate: false
  };
}
```

### 5.2 Conversation Context Management

```typescript
// services/conversation.service.ts
export class ConversationManager {
  private redis: Redis;
  private maxContextTurns = 10; // Keep last 10 turns
  
  async getContext(callSid: string): Promise<ConversationTurn[]> {
    const cached = await this.redis.get(`call:${callSid}`);
    if (!cached) return [];
    
    const callState = JSON.parse(cached);
    return callState.conversationContext || [];
  }
  
  async appendTurn(
    callSid: string, 
    role: 'user' | 'assistant', 
    content: string
  ): Promise<void> {
    const key = `call:${callSid}`;
    const cached = await this.redis.get(key);
    
    let callState = cached ? JSON.parse(cached) : {
      conversationContext: [],
      turnCount: 0,
      startTime: Date.now()
    };
    
    // Add new turn
    callState.conversationContext.push({ role, content });
    callState.turnCount += 1;
    
    // Trim to max context window (keep recent turns)
    if (callState.conversationContext.length > this.maxContextTurns) {
      callState.conversationContext = callState.conversationContext.slice(-this.maxContextTurns);
    }
    
    // Store with 2h TTL
    await this.redis.setex(key, 7200, JSON.stringify(callState));
  }
  
  async clearContext(callSid: string): Promise<void> {
    await this.redis.del(`call:${callSid}`);
  }
}
```

---

## 6. SMS Conversation Engine

### 6.1 Inbound SMS Flow

```typescript
// routes/sms/incoming.ts
export async function handleInboundSMS(req: FastifyRequest, reply: FastifyReply) {
  const { From, To, Body, MessageSid } = req.body as TwilioSMSWebhook;
  
  // 1. Lookup organization (Redis cached)
  const org = await getOrganizationByPhone(To);
  
  // 2. Find or create contact
  const contact = await findOrCreateContact(org.id, From);
  
  // 3. Get conversation context (last 10 messages)
  const conversationKey = `sms:conversation:${org.id}:${From}`;
  const context = await redis.get(conversationKey);
  const messages = context ? JSON.parse(context).messages : [];
  
  // 4. Generate AI reply
  const aiReply = await generateSMSReply(
    org.ai_system_prompt,
    messages,
    Body
  );
  
  // 5. Create communication record (async, don't block response)
  createSMSCommunication(org.id, contact.id, From, To, MessageSid, Body, aiReply)
    .catch(err => console.error('Failed to log SMS:', err));
  
  // 6. Update conversation context in Redis
  messages.push(
    { sender: 'customer', body: Body, timestamp: Date.now() },
    { sender: 'ai', body: aiReply, timestamp: Date.now() }
  );
  
  await redis.setex(
    conversationKey, 
    3600, // 1 hour TTL
    JSON.stringify({ messages: messages.slice(-20), lastMessageAt: Date.now() })
  );
  
  // 7. Return TwiML with AI reply
  reply.type('text/xml').send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Message>${escapeXml(aiReply)}</Message>
    </Response>
  `);
}
```

---

## 7. API Endpoint Specifications

### 7.1 Voice Webhooks

**POST `/api/v1/voice/incoming`**
- **Purpose**: Initial inbound call handler
- **Auth**: Twilio signature validation
- **Request Body** (Twilio standard):
  ```json
  {
    "CallSid": "CA1234567890abcdef",
    "From": "+15551234567",
    "To": "+15559876543",
    "CallStatus": "ringing"
  }
  ```
- **Response**: TwiML XML with `<Gather>` greeting
- **Performance**: < 50ms (Redis cache hit)

**POST `/api/v1/voice/turn`**
- **Purpose**: Handle each conversational turn
- **Auth**: Twilio signature validation
- **Request Body**:
  ```json
  {
    "CallSid": "CA1234567890abcdef",
    "SpeechResult": "I need help with my account",
    "Confidence": "0.95",
    "Digits": "" // DTMF if pressed
  }
  ```
- **Response**: TwiML with AI reply + next `<Gather>`
- **Performance**: < 500ms (including Groq inference)

**POST `/api/v1/voice/status`**
- **Purpose**: Call status callbacks (completed, failed, busy)
- **Auth**: Twilio signature validation
- **Request Body**:
  ```json
  {
    "CallSid": "CA1234567890abcdef",
    "CallStatus": "completed",
    "CallDuration": "120"
  }
  ```
- **Response**: 204 No Content
- **Side Effects**: Update communication record, clear Redis state

### 7.2 SMS Webhooks

**POST `/api/v1/sms/incoming`**
- **Purpose**: Inbound SMS handler
- **Auth**: Twilio signature validation
- **Request Body**:
  ```json
  {
    "MessageSid": "SM1234567890abcdef",
    "From": "+15551234567",
    "To": "+15559876543",
    "Body": "What are your hours?"
  }
  ```
- **Response**: TwiML with AI reply
- **Performance**: < 1 second

### 7.3 Internal REST API

**POST `/api/v1/calls/dispatch`**
- **Purpose**: Initiate outbound call
- **Auth**: Supabase JWT (org member)
- **Request**:
  ```json
  {
    "to": "+15551234567",
    "from": "+15559876543",
    "organizationId": "uuid",
    "context": "This is a follow-up call regarding..."
  }
  ```
- **Response**:
  ```json
  {
    "callSid": "CA...",
    "status": "queued",
    "communicationId": "uuid"
  }
  ```

**GET `/api/v1/communications/:id`**
- **Purpose**: Retrieve call/SMS details with transcript
- **Auth**: Supabase JWT + RLS
- **Response**:
  ```json
  {
    "id": "uuid",
    "type": "voice_in",
    "from": "+15551234567",
    "to": "+15559876543",
    "status": "completed",
    "duration": 120,
    "escalated": false,
    "summary": "Customer inquiry about account balance",
    "transcript": [
      { "speaker": "ai", "content": "Hello, how can I help?", "timestamp": "..." },
      { "speaker": "caller", "content": "What's my balance?", "timestamp": "..." }
    ]
  }
  ```

---

## 8. Frontend Architecture

### 8.1 Next.js App Router Structure

```
app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── dashboard/
│   └── [orgId]/
│       ├── layout.tsx          # Sidebar + org context provider
│       ├── overview/
│       │   └── page.tsx        # Metrics dashboard
│       ├── calls/
│       │   ├── page.tsx        # Call log table
│       │   └── [id]/
│       │       └── page.tsx    # Call detail + transcript
│       ├── inbox/
│       │   └── page.tsx        # Two-pane SMS interface
│       ├── contacts/
│       │   ├── page.tsx        # Contact list
│       │   └── [id]/
│       │       └── page.tsx    # Contact detail + timeline
│       ├── dialer/
│       │   └── page.tsx        # Numeric keypad + dispatch
│       └── settings/
│           ├── ai/
│           │   └── page.tsx    # System prompt editor
│           ├── voice/
│           │   └── page.tsx    # Voice model selector
│           ├── twilio/
│           │   └── page.tsx    # Credentials management
│           └── escalation/
│               └── page.tsx    # Escalation settings
├── api/
│   └── v1/
│       ├── voice/
│       │   ├── incoming/
│       │   │   └── route.ts
│       │   ├── turn/
│       │   │   └── route.ts
│       │   └── status/
│       │       └── route.ts
│       └── sms/
│           └── incoming/
│               └── route.ts
└── layout.tsx                  # Root layout with providers
```

### 8.2 Tailwind Theme Configuration (VirtualPBX-Inspired)

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // VirtualPBX Dark Professional Palette
        'navy-dark': {
          DEFAULT: '#0f1419',      // Main background
          panel: '#1a2332',        // Panel background
          elevated: '#233044',     // Elevated surfaces
          border: '#2d3f56',       // Panel borders
        },
        'slate-blue': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',  // Muted text
          600: '#486581',
          700: '#334e68',  // Secondary text
          800: '#243b53',
          900: '#102a43',
        },
        // Status Colors (matching VirtualPBX)
        status: {
          'in-call': '#ef4444',      // Red indicator
          'available': '#10b981',    // Green indicator  
          'waiting': '#f59e0b',      // Amber/orange
          'resolved': '#06b6d4',     // Cyan
          'offline': '#6b7280',      // Gray
        },
        // Chart Colors (Teal Gradient Stack)
        chart: {
          teal: {
            dark: '#0d9488',
            DEFAULT: '#14b8a6',
            light: '#2dd4bf',
          },
          cyan: {
            dark: '#0891b2',
            DEFAULT: '#06b6d4',
            light: '#22d3ee',
          }
        },
        // Accent Colors
        accent: {
          primary: '#3b82f6',      // Blue for primary actions
          success: '#10b981',      // Green for success
          warning: '#f59e0b',      // Amber for warnings
          danger: '#ef4444',       // Red for danger
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace']
      },
      fontSize: {
        'metric-large': ['3.5rem', { lineHeight: '1', fontWeight: '700', fontFeatureSettings: '"tnum"' }],
        'metric-medium': ['2rem', { lineHeight: '1.2', fontWeight: '600', fontFeatureSettings: '"tnum"' }],
      },
      borderRadius: {
        'panel': '0.75rem',
      },
      boxShadow: {
        'panel': '0 2px 8px 0 rgba(0, 0, 0, 0.4)',
        'panel-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.5)',
        'inset-panel': 'inset 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        'gradient-area': 'linear-gradient(180deg, rgba(20, 184, 166, 0.4) 0%, rgba(6, 182, 212, 0.2) 100%)',
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ]
};

export default config;
```

### 8.3 Component Styling Guidelines (VirtualPBX Style)

**Sidebar Navigation**:
```tsx
// components/layout/Sidebar.tsx
export function Sidebar() {
  return (
    <aside className="w-60 bg-navy-dark-panel border-r border-navy-dark-border h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-navy-dark-border">
        <h1 className="text-xl font-bold text-white">CallPulse</h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        <NavItem icon={Home} label="HOME" href="/dashboard" />
        <NavItem icon={Briefcase} label="MY WORKSPACE" href="/workspace" />
        <NavItem icon={LayoutGrid} label="WALLBOARDS" badge="NEW" />
        <NavItem icon={LayoutDashboard} label="DASHBOARDS" />
        <NavItem icon={FileText} label="REPORTS" expandable />
        <NavItem icon={Filter} label="FILTERS" />
        <NavItem icon={Calendar} label="SCHEDULES" />
      </nav>
      
      {/* Bottom Actions */}
      <div className="p-4 border-t border-navy-dark-border space-y-1">
        <NavItem icon={Settings} label="SETTINGS" />
        <NavItem icon={HelpCircle} label="HELP" />
        <NavItem icon={User} label="PROFILE" />
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, href, badge, expandable }: NavItemProps) {
  return (
    <a 
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
        "text-slate-blue-400 hover:text-white hover:bg-navy-dark-elevated",
        "transition-colors group cursor-pointer"
      )}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 bg-accent-primary text-white text-xs rounded-full">
          {badge}
        </span>
      )}
      {expandable && <ChevronDown className="w-4 h-4 opacity-50" />}
    </a>
  );
}
```

**Metric Card (Top Stats)**:
```tsx
// components/metrics/MetricCard.tsx
export function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  subtitle, 
  trend,
  trendValue 
}: MetricCardProps) {
  return (
    <div className="bg-navy-dark-panel border border-navy-dark-border rounded-xl p-6 shadow-panel">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-navy-dark-elevated rounded-lg">
          <Icon className="w-5 h-5 text-slate-blue-300" />
        </div>
        <span className="text-xs font-semibold text-slate-blue-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      
      {/* Large Metric */}
      <div className="text-metric-large text-white tabular-nums mb-2">
        {value}
      </div>
      
      {/* Subtitle / Trend */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-blue-500">{subtitle}</span>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-semibold",
            trend === 'up' ? "text-status-available" : "text-status-in-call"
          )}>
            <TrendingDown className="w-3 h-3" />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Agent Performance Card (Circular Progress)**:
```tsx
// components/agents/AgentPerformanceCard.tsx
export function AgentPerformanceCard({ agent }: { agent: Agent }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-navy-dark-elevated rounded-lg">
      {/* Avatar */}
      <img 
        src={agent.avatar} 
        alt={agent.name}
        className="w-10 h-10 rounded-full border-2 border-navy-dark-border"
      />
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{agent.name}</div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn(
            "w-2 h-2 rounded-full",
            agent.status === 'available' ? "bg-status-available" : 
            agent.status === 'in-call' ? "bg-status-in-call" : "bg-status-offline"
          )} />
          <span className="text-xs text-slate-blue-500 uppercase">{agent.status}</span>
        </div>
      </div>
      
      {/* Calls Count */}
      <div className="text-2xl font-bold text-white tabular-nums">
        {agent.callsToday}
      </div>
      
      {/* Circular Progress */}
      <CircularProgress 
        value={agent.performancePercent} 
        size={40}
        color={agent.performancePercent >= 90 ? 'emerald' : 'cyan'}
      />
    </div>
  );
}
```

**Live Communications Table**:
```tsx
// components/communications/LiveStreamTable.tsx
export function LiveStreamTable({ calls }: { calls: LiveCall[] }) {
  return (
    <div className="bg-navy-dark-panel border border-navy-dark-border rounded-xl shadow-panel overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-navy-dark-border flex items-center justify-between">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">
          Live Communications Stream
        </h2>
        <button className="p-1 hover:bg-navy-dark-elevated rounded">
          <MoreVertical className="w-4 h-4 text-slate-blue-400" />
        </button>
      </div>
      
      {/* Table */}
      <table className="w-full">
        <thead className="bg-navy-dark text-xs text-slate-blue-400 uppercase">
          <tr>
            <th className="px-6 py-3 text-left font-semibold">Caller ID (Number)</th>
            <th className="px-6 py-3 text-left font-semibold">Call Path (Queue)</th>
            <th className="px-6 py-3 text-left font-semibold">Agent Assigned</th>
            <th className="px-6 py-3 text-left font-semibold">Current Status</th>
            <th className="px-6 py-3 text-left font-semibold">Sentiment (AI Score)</th>
            <th className="px-6 py-3 text-left font-semibold">Duration</th>
            <th className="px-6 py-3 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-dark-border">
          {calls.map((call) => (
            <tr key={call.id} className="hover:bg-navy-dark-elevated transition-colors">
              <td className="px-6 py-4 text-sm text-white font-mono">{call.callerNumber}</td>
              <td className="px-6 py-4 text-sm text-slate-blue-300">{call.queue}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <img src={call.agent.avatar} className="w-6 h-6 rounded-full" />
                  <span className="text-sm text-white">{call.agent.name}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <StatusBadge status={call.status} />
              </td>
              <td className="px-6 py-4">
                <SentimentIndicator score={call.sentiment} />
              </td>
              <td className="px-6 py-4 text-sm text-white font-mono tabular-nums">
                {formatDuration(call.duration)}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1 bg-navy-dark-elevated hover:bg-slate-blue-800 text-xs text-white rounded-md transition-colors">
                    Call Transfer
                  </button>
                  <button className="px-3 py-1 bg-navy-dark-elevated hover:bg-slate-blue-800 text-xs text-white rounded-md transition-colors">
                    Note
                  </button>
                  <button className="px-3 py-1 bg-accent-danger hover:bg-red-600 text-xs text-white rounded-md transition-colors">
                    Escalation
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    'in-call': { bg: 'bg-status-in-call/10', text: 'text-status-in-call', dot: 'bg-status-in-call' },
    'available': { bg: 'bg-status-available/10', text: 'text-status-available', dot: 'bg-status-available' },
    'waiting': { bg: 'bg-status-waiting/10', text: 'text-status-waiting', dot: 'bg-status-waiting' },
  }[status] || { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400' };
  
  return (
    <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase", config.bg, config.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
      {status}
    </span>
  );
}
```

**Stacked Area Chart**:
```tsx
// components/charts/StackedAreaChart.tsx (using Recharts)
export function PerformanceChart({ data }: { data: ChartData[] }) {
  return (
    <div className="bg-navy-dark-panel border border-navy-dark-border rounded-xl p-6 shadow-panel">
      <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="incomingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0d9488" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#0d9488" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="waitingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.1}/>
            </linearGradient>
            <linearGradient id="resolvedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3f56" opacity={0.3} />
          <XAxis 
            dataKey="time" 
            stroke="#627d98" 
            style={{ fontSize: '11px' }}
            tick={{ fill: '#627d98' }}
          />
          <YAxis 
            stroke="#627d98" 
            style={{ fontSize: '11px' }}
            tick={{ fill: '#627d98' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1a2332', 
              border: '1px solid #2d3f56',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend 
            wrapperStyle={{ color: '#9fb3c8', fontSize: '12px' }}
            iconType="circle"
          />
          <Area 
            type="monotone" 
            dataKey="incoming" 
            stackId="1"
            stroke="#0d9488" 
            fill="url(#incomingGradient)" 
            name="Incoming Calls"
          />
          <Area 
            type="monotone" 
            dataKey="waiting" 
            stackId="1"
            stroke="#14b8a6" 
            fill="url(#waitingGradient)" 
            name="Waiting"
          />
          <Area 
            type="monotone" 
            dataKey="resolved" 
            stackId="1"
            stroke="#06b6d4" 
            fill="url(#resolvedGradient)" 
            name="Resolved"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## 9. Deployment Configuration

### 9.1 Render Blueprint (`render.yaml`)

```yaml
services:
  # Backend API + WebSocket Server
  - type: web
    name: callpulse-api
    env: node
    region: oregon
    plan: standard
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5050
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: REDIS_URL
        fromService:
          type: redis
          name: callpulse-redis
          property: connectionString
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: GROQ_API_KEY
        sync: false
    healthCheckPath: /api/v1/health
    
  # Next.js Frontend (Static Site)
  - type: web
    name: callpulse-web
    env: static
    buildCommand: cd web && npm install && npm run build
    staticPublishPath: ./web/out
    routes:
      - type: rewrite
        source: /api/*
        destination: https://callpulse-api.onrender.com/api/*

# Redis Cache
databases:
  - name: callpulse-redis
    plan: starter
    region: oregon
    ipAllowList: []
```

### 9.2 Environment Variables

```bash
# .env.example
NODE_ENV=development
PORT=5050

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis
REDIS_URL=redis://localhost:6379

# Twilio (Organization-specific, stored in DB)
# These are fallback/admin credentials
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Groq AI
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional: ElevenLabs (premium feature)
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Base URL (for TwiML generation)
BASE_URL=https://api.callpulse.io
```

---

## 10. Performance Optimization Checklist

- **Database Indexes**: All foreign keys, lookup columns, and frequent WHERE clauses
- **Connection Pooling**: Max 50 connections via Supabase Supavisor
- **Redis Caching**: 95%+ cache hit rate for org configs
- **Query Optimization**: Use `EXPLAIN ANALYZE` to verify index usage
- **Lazy Loading**: Dashboard charts load data on-demand
- **Pagination**: Limit 50 items per page, cursor-based pagination
- **Compression**: Gzip enabled for API responses > 1KB
- **CDN**: Next.js static assets served via Render CDN
- **Monitoring**: Prometheus metrics for latency, cache hits, error rates

---

**Document Version**: 1.0  
**Last Updated**: 2026-09-15  
**Maintained By**: CallPulse Engineering Team
