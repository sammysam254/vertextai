# CallPulse Documentation

Welcome to the CallPulse documentation! This directory contains all technical documentation for the platform.

## 📚 Documentation Index

### API Documentation
- **[OpenAPI Specification](./api/openapi.yaml)** - Complete REST API and webhook documentation in OpenAPI 3.0 format

### Deployment & Operations
- **[Deployment Guide](./DEPLOYMENT.md)** - Step-by-step production deployment instructions for Render.com
- **[Development Guide](../README.md)** - Local development setup and workflows

### Architecture & Design
- **[Requirements](../requirements.md)** - Product requirements and specifications
- **[System Design](../design.md)** - Technical architecture and database schema
- **[Task List](../tasks.md)** - Implementation task tracking

## 🚀 Quick Start

### For Developers
1. Read [Development Guide](../README.md) for local setup
2. Review [System Design](../design.md) for architecture overview
3. Check [OpenAPI Spec](./api/openapi.yaml) for API contracts

### For DevOps
1. Follow [Deployment Guide](./DEPLOYMENT.md) for production setup
2. Configure monitoring and alerts
3. Set up automated backups

## 📖 Key Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [requirements.md](../requirements.md) | Product specifications | Product, Engineering |
| [design.md](../design.md) | Technical architecture | Engineering |
| [openapi.yaml](./api/openapi.yaml) | API documentation | Frontend, Backend, Integrations |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deployment | DevOps, Engineering |
| [tasks.md](../tasks.md) | Implementation tracking | Engineering, PM |

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CallPulse Architecture                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│              │     │              │     │              │
│   Twilio     │────▶│   Fastify    │────▶│  Supabase    │
│   (Voice/    │     │   Backend    │     │  PostgreSQL  │
│    SMS)      │     │              │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                            │
                     ┌──────▼───────┐
                     │              │
                     │  Redis Cache │
                     │  (ioredis)   │
                     │              │
                     └──────────────┘
                            │
                            │
                     ┌──────▼───────┐
                     │              │
                     │  Groq API    │
                     │  (Llama 3)   │
                     │              │
                     └──────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    Next.js Frontend Dashboard                    │
│                    (VirtualPBX Dark Theme)                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 🔑 Key Features

- **Turn-Based Voice AI**: Sub-500ms response times using Twilio native transcription
- **SMS Automation**: Context-aware conversational SMS with full history
- **Multi-Tenant**: Organization-level isolation with RLS policies
- **Real-Time Dashboard**: Live metrics, agent performance, call streams
- **Ultra-Low Latency**: Redis caching, Groq AI (300ms+ faster than OpenAI)
- **Zero-Cost AI**: Groq API with generous free tier
- **Production-Ready**: Full error handling, monitoring, graceful degradation

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Fastify 4.x
- **Database**: Supabase PostgreSQL with RLS
- **Cache**: Redis (ioredis)
- **AI**: Groq API (Llama 3.1)
- **Telephony**: Twilio Voice & Messaging

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS 3.x
- **UI Library**: Custom VirtualPBX-inspired components
- **Charts**: Recharts
- **Auth**: Supabase SSR
- **State**: React hooks (no Redux)

### Infrastructure
- **Hosting**: Render.com (Web Service + Redis + Static Site)
- **Database**: Supabase Cloud
- **Monitoring**: Render built-in + Supabase metrics
- **CI/CD**: Git-based auto-deploy

## 📊 Project Statistics

- **Total Files**: 60+ TypeScript/TSX files
- **Lines of Code**: ~12,000 LOC
- **Backend Services**: 12 services
- **API Endpoints**: 20+ routes
- **Webhooks**: 6 Twilio webhooks
- **Frontend Pages**: 15+ dashboard pages
- **UI Components**: 25+ reusable components
- **Database Tables**: 6 tables with 25+ indexes

## 🔗 Related Links

- **GitHub Repository**: [github.com/your-org/callpulse](https://github.com)
- **Production Dashboard**: [app.callpulse.io](https://app.callpulse.io)
- **API Base URL**: [api.callpulse.io](https://api.callpulse.io)
- **Supabase Dashboard**: [supabase.com/dashboard](https://supabase.com/dashboard)
- **Twilio Console**: [twilio.com/console](https://twilio.com/console)
- **Groq Console**: [console.groq.com](https://console.groq.com)

## 📝 Contributing

1. Review [System Design](../design.md) before making changes
2. Follow existing code patterns and conventions
3. Update documentation when adding features
4. Test thoroughly (unit + integration tests)
5. Update OpenAPI spec for API changes

## 📄 License

Proprietary - All rights reserved

## 📧 Support

- **Email**: support@callpulse.io
- **Documentation Issues**: Open GitHub issue
- **Technical Questions**: engineering@callpulse.io

---

**Last Updated**: 2026-09-15  
**Version**: 1.0.0  
**Status**: Production Ready ✅
