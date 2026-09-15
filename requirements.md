# CallPulse - AI Call Center & SMS SaaS Platform
## Requirements Specification v1.0

---

## 1. Executive Summary

**CallPulse** is a production-ready, multi-tenant AI-powered call center and unified messaging SaaS platform designed for ultra-low network egress, minimal API costs, and sub-second response latency during live telephony operations.

**Target Deployment**: Render.com managed infrastructure with Supabase PostgreSQL and Redis caching layer.

**Core Value Proposition**: 
- Instant AI-powered voice and SMS interactions with sub-200ms response times
- Zero-bandwidth streaming using turn-based Twilio native protocols
- Intelligent human escalation with seamless call transfer
- Enterprise-grade multi-tenancy with row-level security
- Industrial dark UI aesthetic (zero emojis, professional tone)

---

## 2. Functional Requirements

### 2.1 Multi-Tenant Organization Management

**FR-ORG-001**: System must support unlimited isolated organizations (tenants)
- Each organization has independent Twilio credentials
- Isolated data access via PostgreSQL Row Level Security (RLS)
- Organization-scoped phone numbers, contacts, and communication history

**FR-ORG-002**: Organization membership and role-based access control
- Roles: `owner`, `admin`, `agent`
- Owners can manage billing, credentials, and delete organization
- Admins can configure AI settings and manage contacts
- Agents can view communications and manually respond to messages

**FR-ORG-003**: Organization configuration management
- AI system prompt customization (persona, tone, domain knowledge)
- Voice model selection (Twilio Polly voices, optional ElevenLabs)
- Escalation phone number for human handoff
- Twilio account SID and auth token storage (encrypted)

### 2.2 Inbound Voice Call Handling

**FR-VOICE-001**: Automatic call routing based on Twilio phone number lookup
- Incoming call to `/api/v1/voice/incoming` webhook
- Sub-2ms Redis cache lookup for organization configuration
- Return TwiML with `<Gather>` for turn-based interaction (no media streaming by default)

**FR-VOICE-002**: Turn-based conversational AI using Twilio `<Gather>` + Groq API
- Customer speaks → Twilio transcribes via `<Gather input="speech">`
- Server receives transcript → Groq Llama 3 generates reply (target <500ms)
- Server returns TwiML with `<Say>` or `<Play>` for AI response
- Loop continues until call ends or escalation triggered

**FR-VOICE-003**: Intelligent human escalation protocol
- AI detects escalation keywords or conversation stall
- Executes `<Say>Please hold while I connect you...</Say><Dial>{{escalation_number}}</Dial>`
- Marks communication record with `escalated_to_human: true` and reason
- Saves full transcript to database before transfer

**FR-VOICE-004**: Real-time call state tracking
- Active call metadata stored in Redis (`call:<call_sid>`)
- Conversation context window for multi-turn coherence
- Automatic expiration after 2 hours (call timeout safety)

### 2.3 Outbound Voice Calling

**FR-VOICE-005**: Programmatic outbound dialing via REST API
- `POST /api/v1/calls/dispatch` with target phone number and campaign context
- Twilio call initiation with organization's caller ID
- Automatic connection to media stream or turn-based handler upon answer

**FR-VOICE-006**: Outbound campaign management
- Bulk dialing with rate limiting (respect Twilio API limits)
- Campaign tracking (completion rate, pickup rate, average duration)
- Personalized AI greetings based on contact metadata

### 2.4 SMS/MMS Messaging

**FR-SMS-001**: Inbound SMS handling with conversational AI
- Incoming message to `/api/v1/sms/incoming` webhook
- Organization lookup via recipient phone number (Redis cached)
- Context-aware reply generation using Groq API
- Automatic conversation threading per contact

**FR-SMS-002**: Outbound SMS sending
- Manual agent-initiated messages from dashboard
- Automated campaign messages (drip sequences, reminders)
- Message status tracking (delivered, failed, read receipts)

**FR-SMS-003**: Two-way conversation history
- Chronological message thread per contact
- Sender attribution (customer, AI, human agent)
- Message search and filtering

### 2.5 Contact Management

**FR-CONTACT-001**: Organization-scoped contact database
- Contact fields: phone number (primary key), name, email, custom metadata (JSONB)
- Automatic contact creation on first inbound communication
- Manual contact import (CSV, API)

**FR-CONTACT-002**: Contact enrichment and tagging
- Custom metadata fields for CRM integration
- Contact activity timeline (all calls, messages, notes)

### 2.6 Communication Logging and Transcripts

**FR-LOG-001**: Comprehensive communication audit trail
- Every call and SMS logged in `communications` table
- Call duration, status, timestamps, cost tracking
- Escalation events and reasons captured

**FR-LOG-002**: Full call transcription storage
- Speaker-segmented transcripts in `call_transcripts` table
- Timestamp-aligned transcript chunks
- Searchable transcript content

**FR-LOG-003**: AI conversation summaries
- Automatic post-call summary generation
- Key points extraction (intent, resolution status, action items)
- Sentiment analysis (optional)

---

## 3. Non-Functional Requirements

### 3.1 Performance & Latency

**NFR-PERF-001**: Voice response latency < 500ms (Redis lookup + Groq inference + TwiML generation)

**NFR-PERF-002**: SMS reply latency < 1 second

**NFR-PERF-003**: Redis cache hit rate > 95% for organization config lookups

**NFR-PERF-004**: Database query response time < 50ms (99th percentile) via proper indexing

### 3.2 Scalability

**NFR-SCALE-001**: Support 1000+ concurrent voice calls per deployment (horizontal scaling)

**NFR-SCALE-002**: Handle 10,000+ SMS messages per minute

**NFR-SCALE-003**: Database connection pooling via Supabase Supavisor (max 50 connections)

**NFR-SCALE-004**: Redis connection pool with circuit breaker pattern

### 3.3 Availability & Reliability

**NFR-AVAIL-001**: 99.9% uptime SLA (excluding Twilio/Supabase downtime)

**NFR-AVAIL-002**: Graceful degradation on Redis failure (fallback to direct database queries)

**NFR-AVAIL-003**: Automatic retry with exponential backoff for Twilio API calls

**NFR-AVAIL-004**: Health check endpoints for Render orchestration

### 3.4 Security & Compliance

**NFR-SEC-001**: All Twilio credentials encrypted at rest (Supabase vault or environment secrets)

**NFR-SEC-002**: Row Level Security (RLS) enforced on all multi-tenant tables

**NFR-SEC-003**: Webhook signature verification for all Twilio callbacks

**NFR-SEC-004**: TLS 1.3 for all external API communication

**NFR-SEC-005**: PII data redaction in logs (phone numbers masked)

### 3.5 Cost Optimization

**NFR-COST-001**: Zero-egress audio streaming (use Twilio `<Gather>` native transcription)

**NFR-COST-002**: Groq API usage for $0 inference cost (free tier Llama 3)

**NFR-COST-003**: Redis caching to minimize Supabase connection usage

**NFR-COST-004**: Efficient database queries with proper indexes (avoid full table scans)

---

## 4. Technical Stack

### 4.1 Backend

- **Runtime**: Node.js 20.x LTS
- **Framework**: Fastify 4.x (high-performance HTTP server)
- **WebSocket**: `ws` library for Twilio media streams
- **Language**: TypeScript 5.x (strict mode)

### 4.2 Database & Caching

- **Primary Database**: Supabase PostgreSQL 15.x
  - Row Level Security (RLS) for multi-tenancy
  - Connection pooling via Supavisor (PgBouncer)
  - Full-text search for transcripts
- **Caching Layer**: Upstash Redis or Render Redis
  - `ioredis` client library
  - Cache-aside pattern with automatic invalidation
  - 24-hour TTL for organization configs

### 4.3 Telephony & AI

- **Voice/SMS Provider**: Twilio
  - Programmable Voice (TwiML `<Gather>` + `<Say>`)
  - Twilio Messaging API
  - REST API for call control
- **AI Inference**: Groq API (Meta Llama 3 8B/70B)
  - Streaming completions for low latency
  - Function calling for escalation triggers
  - Fallback to OpenAI GPT-4o-mini if quota exceeded
- **Text-to-Speech**: Twilio Polly Neural voices (default)
  - Optional ElevenLabs integration (premium feature)

### 4.4 Frontend

- **Framework**: Next.js 14.x (App Router)
- **Styling**: Tailwind CSS 3.x
- **UI Components**: Custom components (no shadcn/ui templates)
- **Icons**: Lucide React (zero emojis)
- **State Management**: React Server Components + Server Actions
- **Real-time Updates**: Supabase Realtime (PostgreSQL change streams)

### 4.5 Deployment

- **Platform**: Render.com
  - Web Service (Fastify backend, port 5050)
  - Static Site (Next.js frontend)
  - Managed Redis (persistent cache)
- **CI/CD**: Git-based auto-deploy from `main` branch
- **Monitoring**: Render metrics + custom health checks

---

## 5. User Interface Requirements

### 5.1 Design System Specifications (VirtualPBX-Inspired)

**UI-DESIGN-001**: Professional dark navy contact center aesthetic
- Base background: `#0f1419` (deep navy)
- Panel background: `#1a2332` (navy panel)
- Panel borders: `#2d3f56` (slate blue border)
- Primary accent: `#3b82f6` (professional blue)
- Status colors: Green `#10b981`, Red `#ef4444`, Amber `#f59e0b`, Cyan `#06b6d4`
- Chart gradient: Teal/Cyan stacked areas (`#0d9488` → `#14b8a6` → `#06b6d4`)
- Typography: Inter (sans-serif), tabular figures for all metrics
- No glassmorphism, no neon glows, clean panel separation

**UI-DESIGN-002**: Zero emojis policy
- All status indicators use colored dots + text labels
- Icons from lucide-react only (no emoji characters)
- Empty states use icon + descriptive text
- No emoji in buttons, badges, navigation, or alerts

**UI-DESIGN-003**: Professional enterprise call center tone
- Copy uses operational language:
  - "Active Queues" not "Live Chats"
  - "Queue Waiting Time" not "Wait Time"  
  - "Live Service Level" not "Performance"
  - "Call Transfer" not "Move Call"
  - "Agent Performance Summary" not "Top Performers"
- Avoid marketing hype ("Amazing!", "Best Ever", "Incredible")
- Human-authored, enterprise-grade terminology

**UI-DESIGN-004**: VirtualPBX layout patterns
- Left sidebar: 240px wide, dark navy, icon + label navigation
- Top metrics row: 4-6 cards with large numbers, icons, and micro-trends
- Performance chart: Stacked area chart with teal/cyan gradients, 24-hour timeline
- Live stream table: Full-width table with agent avatars, status dots, action buttons
- Agent summary: Circular progress indicators with profile photos

### 5.2 Responsive Layout

**UI-LAYOUT-001**: Desktop sidebar navigation (240px wide)
- Collapsible with persistence (localStorage)
- Clear hierarchical groups: Operations, Communications, Workspace, Settings
- Active route highlighting

**UI-LAYOUT-002**: Mobile slide-over drawer
- Triggered by hamburger button (top-left)
- Full-screen overlay with backdrop blur
- Swipe-to-close gesture support

**UI-LAYOUT-003**: Responsive data tables
- Desktop: Full table with sortable columns
- Mobile: Card stack layout with swipe gestures
- Virtualized scrolling for 1000+ rows

### 5.3 Dashboard Pages

**UI-PAGE-001**: Overview Dashboard (`/dashboard/[orgId]/overview`)
- **Top Metrics Row** (4-6 cards):
  - Queue Waiting Time (large seconds display: "42s")
  - Lost Calls Rate (percentage with trend arrow: "6.1%" + red down arrow + "13 Total")
  - Live Service Level (percentage with goal: "94%" + "Goal 53%")
  - Active Calls Count
- **Agent Performance Summary Panel** (right sidebar or embedded):
  - Agent cards with circular progress indicators
  - Agent photo, name, status dot (Available/In Call)
  - Calls handled today count
  - Performance percentage ring
- **Performance Chart** (full-width stacked area):
  - 24-hour timeline (11:00 to 24:00)
  - Three stacked areas: Incoming Calls (dark teal), Waiting (teal), Resolved (cyan)
  - Legend with color indicators
  - Grid lines and axis labels
- **Active Queues Panel** (left sidebar or top-left):
  - Queue Name | Status | Count
  - Sales: IN CALL (45x)
  - Reception: AVAILABLE (0)
  - Development: IN CALL (12x)
  - Admin: IN CALL (0)
  - Support: AVAILABLE (0)
- **Live Communications Stream Table** (bottom section):
  - Columns: Caller ID (Number), Call Path (Queue), Agent Assigned (avatar + name), Current Status (colored badge), Sentiment (AI Score - emoji indicators), Duration (timer), Actions (buttons)
  - Status badges with colored dots (red = IN CALL, green = AVAILABLE)
  - Action buttons: "Call Transfer", "Note", "Escalation"
  - Alternating row hover states

**UI-PAGE-002**: Calls Log (`/dashboard/[orgId]/calls`)
- Filterable table: date range, status, escalation flag, duration
- Status badges (completed, in-progress, failed, escalated)
- Expandable row for full transcript viewer
- Export to CSV

**UI-PAGE-003**: Inbox (`/dashboard/[orgId]/inbox`)
- Two-pane layout: contact list (left) + message thread (right)
- Unread message indicators
- Manual agent reply input with send button
- Auto-refresh every 5 seconds or real-time subscription

**UI-PAGE-004**: Contacts (`/dashboard/[orgId]/contacts`)
- Searchable contact list
- Add/edit contact modal
- Contact activity timeline (expandable)
- Bulk import via CSV upload

**UI-PAGE-005**: Dialer (`/dashboard/[orgId]/dialer`)
- Numeric keypad for manual dialing
- Caller ID dropdown (organization phone numbers)
- Click-to-dial from contact list
- Outbound campaign trigger (bulk dialing)

**UI-PAGE-006**: Settings (`/dashboard/[orgId]/settings`)
- AI Configuration tab: system prompt editor, voice model selector
- Twilio Credentials tab: account SID, auth token, phone numbers
- Escalation Settings tab: human handoff number, escalation keywords
- Cache Management tab: flush organization cache button

---

## 6. API Endpoints Specification

### 6.1 Twilio Webhooks (Public, signature-verified)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/voice/incoming` | POST | Inbound call webhook (returns TwiML) |
| `/api/v1/voice/turn` | POST | Turn-based conversation loop |
| `/api/v1/voice/status` | POST | Call status callbacks (completed, failed) |
| `/api/v1/sms/incoming` | POST | Inbound SMS webhook (returns TwiML) |
| `/api/v1/sms/status` | POST | Message status callbacks |
| `/media-stream` | WebSocket | Real-time audio streaming (optional) |

### 6.2 Internal REST API (Auth-protected)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/calls/dispatch` | POST | Trigger outbound call |
| `/api/v1/calls/:id` | GET | Retrieve call details + transcript |
| `/api/v1/messages/send` | POST | Send outbound SMS |
| `/api/v1/messages/:id` | GET | Retrieve message thread |
| `/api/v1/contacts` | GET | List contacts (paginated) |
| `/api/v1/contacts` | POST | Create new contact |
| `/api/v1/contacts/:id` | PATCH | Update contact metadata |
| `/api/v1/organizations/:id` | GET | Get organization config |
| `/api/v1/organizations/:id` | PATCH | Update AI/voice settings |
| `/api/v1/health` | GET | Health check (Redis, DB, Twilio) |

---

## 7. Data Privacy & Retention

**DR-001**: Call recordings are NOT stored (transcripts only) unless explicitly enabled

**DR-002**: Transcripts retained for 90 days, then archived to cold storage (S3)

**DR-003**: Contact PII deletion within 30 days of request (GDPR/CCPA compliance)

**DR-004**: Audit log for all data access (user, timestamp, operation)

---

## 8. Success Metrics

**KPI-001**: Voice response latency < 500ms (p95)

**KPI-002**: SMS reply latency < 1 second (p95)

**KPI-003**: AI resolution rate > 70% (calls not escalated)

**KPI-004**: System uptime > 99.9%

**KPI-005**: Average call cost < $0.05 per minute (Twilio + Groq)

**KPI-006**: Customer satisfaction score > 4.5/5 (post-call survey)

---

## 9. Out of Scope (Phase 1)

- Video calling or screen sharing
- CRM integrations (Salesforce, HubSpot) - manual export only
- Advanced analytics dashboard (heatmaps, funnel analysis)
- Multi-language support (English only in Phase 1)
- Call recording storage (transcripts only)
- Desktop/mobile native apps (web-only)

---

## 10. Acceptance Criteria

**AC-001**: Successful inbound call handling with AI response in < 500ms

**AC-002**: Human escalation triggers live call transfer within 2 seconds

**AC-003**: SMS auto-reply with conversational context in < 1 second

**AC-004**: Dashboard loads all pages in < 200ms (with Redis cache warm)

**AC-005**: Zero UI emojis, fully responsive mobile layout

**AC-006**: Successful deployment to Render with zero manual configuration

**AC-007**: Complete API documentation with Postman collection

---

**Document Version**: 1.0  
**Last Updated**: 2026-09-15  
**Maintained By**: CallPulse Engineering Team
