# CallPulse Backend API

Production-ready Fastify backend for CallPulse AI Call Center & SMS SaaS platform.

## Features

- **Turn-Based Voice AI**: Low-latency conversational AI using Twilio `<Gather>` + Groq API
- **SMS Auto-Reply**: Context-aware SMS conversations with thread management
- **Redis Caching**: Sub-2ms organization lookups with cache-aside pattern
- **Multi-Tenant**: PostgreSQL RLS with Supabase for data isolation
- **WebSocket Support**: Optional real-time audio streaming (Media Streams)
- **Intelligent Escalation**: Automatic human handoff with live call transfer

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- PostgreSQL 15+ (or Supabase account)
- Redis 7+ (or Upstash/Render Redis)
- Twilio account with phone number
- Groq API key (free tier available)

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Start local dependencies (PostgreSQL + Redis)
cd ..
docker-compose up -d

# Run database migrations (in Supabase dashboard or via CLI)
# Import ../supabase/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

Server runs on http://localhost:5050

### Health Check

```bash
curl http://localhost:5050/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-15T10:30:00.000Z",
  "services": {
    "redis": { "status": "up", "latency": 1 },
    "database": { "status": "up", "latency": 5 },
    "twilio": { "status": "up" }
  },
  "cache": {
    "hits": 1234,
    "misses": 56,
    "hitRate": 0.956
  }
}
```

## Architecture

### Request Flow

```
Twilio → Webhook → Redis Cache → Groq AI → TwiML Response
           ↓
      Supabase (async logging)
```

### Directory Structure

```
src/
├── server.ts              # Fastify server entry point
├── app.ts                 # Fastify app configuration
├── types/                 # TypeScript type definitions
├── lib/                   # Core utilities
│   ├── config.ts          # Environment configuration
│   ├── logger.ts          # Pino logger setup
│   ├── redis.ts           # Redis client & connection pool
│   └── supabase.ts        # Supabase client
├── services/              # Business logic layer
│   ├── database/          # Database service (org, contacts, comms)
│   ├── ai/                # AI service (Groq, OpenAI)
│   ├── twilio/            # Twilio service (TwiML, REST API)
│   └── cache/             # Cache service (Redis helpers)
├── routes/                # API route handlers
│   ├── voice/             # Voice webhooks
│   ├── sms/               # SMS webhooks
│   ├── calls.ts           # Internal call API
│   ├── messages.ts        # Internal message API
│   ├── contacts.ts        # Contact management
│   └── organizations.ts   # Organization settings
└── middleware/            # Fastify middleware
    ├── error-handler.ts   # Global error handling
    └── twilio-validator.ts # Webhook signature validation
```

## API Endpoints

### Public Webhooks (Twilio)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/voice/incoming` | POST | Inbound call webhook |
| `/api/v1/voice/turn` | POST | Turn-based conversation handler |
| `/api/v1/voice/status` | POST | Call status callbacks |
| `/api/v1/sms/incoming` | POST | Inbound SMS webhook |
| `/api/v1/sms/status` | POST | Message delivery status |
| `/media-stream` | WebSocket | Real-time audio streaming |

### Internal REST API (Auth-protected)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/calls/dispatch` | POST | Initiate outbound call |
| `/api/v1/calls/:id` | GET | Get call details + transcript |
| `/api/v1/messages/send` | POST | Send outbound SMS |
| `/api/v1/communications` | GET | List communications (paginated) |
| `/api/v1/contacts` | GET/POST | List/create contacts |
| `/api/v1/organizations/:id` | GET/PATCH | Get/update org settings |

## Environment Variables

See `.env.example` for complete list. Key variables:

```bash
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
GROQ_API_KEY=gsk_xxx
JWT_SECRET=xxx

# Redis (local or cloud)
REDIS_HOST=localhost  # or use REDIS_URL for cloud
REDIS_PORT=6379

# Twilio (fallback/admin credentials)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
```

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Deployment

### Render.com

1. Push code to GitHub
2. Connect repo to Render
3. Deploy using `render.yaml` blueprint (in root directory)
4. Set environment variables in Render dashboard
5. Deploy backend as Web Service + managed Redis

### Docker

```bash
# Build image
docker build -t callpulse-backend -f backend/Dockerfile .

# Run container
docker run -p 5050:5050 \
  -e SUPABASE_URL=xxx \
  -e GROQ_API_KEY=xxx \
  callpulse-backend
```

## Performance Targets

- **Voice Response**: < 500ms (p95)
- **SMS Reply**: < 1 second (p95)
- **Cache Hit Rate**: > 95%
- **Database Query**: < 50ms (p99)

## Monitoring

Metrics exposed via `/api/v1/health`:
- Service availability (Redis, DB, Twilio)
- Cache hit/miss rates
- Response latencies

## Troubleshooting

### Redis Connection Failed
```bash
# Check Redis is running
docker-compose ps redis

# Test connection
redis-cli ping
```

### Twilio Webhook Errors
- Verify webhook URL is publicly accessible (use ngrok for local dev)
- Check Twilio signature validation is passing
- Review Fastify logs for error details

### Database Query Slow
- Verify indexes are created (check `001_initial_schema.sql`)
- Check Supabase connection pooler is enabled
- Review query execution plan with `EXPLAIN ANALYZE`

## License

Proprietary - CallPulse Engineering Team
