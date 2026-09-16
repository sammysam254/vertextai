# CallPulse API Keys & Environment Variables

This file consolidates all API keys and environment variables needed for the CallPulse application.

## 🔐 Security Notice

**NEVER commit this file with actual values to version control!**

This is a reference guide. Actual keys should be stored in:
- `.env` (root directory - for local development)
- `backend/.env` (backend-specific)
- `web/.env.local` (Next.js frontend)
- Deployment platform environment variables (for production)

---

## 📋 Required Services & Where to Get Keys

### 1. **Supabase** (Database & Authentication)
- 🌐 Sign up at: https://supabase.com
- 📍 Get keys from: Project Settings → API
- 💰 Cost: Free tier available

**Required Keys:**
```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
DATABASE_URL=postgresql://postgres:password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

### 2. **Twilio** (Voice & SMS)
- 🌐 Sign up at: https://www.twilio.com
- 📍 Get keys from: Console → Account Info
- 💰 Cost: Pay-as-you-go ($15 trial credit)

**Required Keys:**
```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555550000
```

### 3. **Groq** (AI/LLM - Primary)
- 🌐 Sign up at: https://console.groq.com
- 📍 Get keys from: API Keys section
- 💰 Cost: Free tier with rate limits

**Required Keys:**
```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant
```

**Model Options:**
- `llama-3.1-8b-instant` - Fastest, free tier
- `llama-3.1-70b-versatile` - Most capable
- `mixtral-8x7b-32768` - Long context window

### 4. **Redis** (Caching)
- 🌐 Local: Install Redis locally
- 🌐 Cloud: https://redis.com or https://upstash.com
- 💰 Cost: Free tier available

**Required Keys:**
```bash
# Local Development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Production (if using cloud Redis)
REDIS_URL=redis://:password@redis-hostname:6379
```

### 5. **OpenAI** (Optional Fallback)
- 🌐 Sign up at: https://platform.openai.com
- 📍 Get keys from: API Keys section
- 💰 Cost: Pay-as-you-go

**Optional Keys:**
```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini
```

### 6. **ElevenLabs** (Optional Premium TTS)
- 🌐 Sign up at: https://elevenlabs.io
- 📍 Get keys from: Profile → API Keys
- 💰 Cost: Free tier available

**Optional Keys:**
```bash
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

---

## 📝 Complete Environment Variables Template

### Root `.env` (Full Stack Local Development)

```bash
# ==============================================
# CallPulse Environment Configuration
# ==============================================

# Node Environment
NODE_ENV=development

# Backend Server
PORT=5050
BASE_URL=http://localhost:5050

# ==============================================
# Supabase Configuration
# ==============================================
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx

# Supabase Database Direct Connection (for migrations)
DATABASE_URL=postgresql://postgres:password@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# ==============================================
# Redis Configuration
# ==============================================
# Local development
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Production (Render Redis or Upstash)
# REDIS_URL=redis://:password@redis-hostname:6379

# ==============================================
# Twilio Configuration (Fallback/Admin)
# ==============================================
# Note: Each organization stores their own Twilio credentials in the database
# These are fallback credentials for system-level operations
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555550000

# ==============================================
# Groq AI Configuration
# ==============================================
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant

# ==============================================
# OpenAI Configuration (Optional Fallback)
# ==============================================
# OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# OPENAI_MODEL=gpt-4o-mini

# ==============================================
# ElevenLabs TTS (Optional Premium Feature)
# ==============================================
# ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# ==============================================
# Application Settings
# ==============================================
# JWT Secret for internal auth tokens
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000

# Cache TTL (seconds)
CACHE_ORG_TTL=86400
CACHE_CALL_TTL=7200
CACHE_SMS_TTL=3600

# ==============================================
# Logging & Monitoring
# ==============================================
LOG_LEVEL=info
MASK_PII_IN_LOGS=true

# ==============================================
# Frontend (Next.js)
# ==============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
NEXT_PUBLIC_API_URL=http://localhost:5050
```

### Backend `backend/.env`

```bash
NODE_ENV=development
PORT=5050
BASE_URL=http://localhost:5050

SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant

JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
LOG_LEVEL=debug
MASK_PII_IN_LOGS=true
```

### Frontend `web/.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5050
```

---

## 🚀 Production Deployment Variables

### Render.com / Railway / Vercel Environment Variables

Set these in your deployment platform's environment variables section:

```bash
# Required
NODE_ENV=production
PORT=5050
BASE_URL=https://your-app.onrender.com

SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx

REDIS_URL=redis://:password@redis-hostname:6379

TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15555550000

GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant

JWT_SECRET=use-a-strong-random-secret-here
LOG_LEVEL=info
MASK_PII_IN_LOGS=true

# Frontend (Vercel/Netlify)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

---

## ✅ Quick Setup Checklist

- [ ] Create Supabase project and get credentials
- [ ] Create Twilio account and get phone number
- [ ] Create Groq account and get API key
- [ ] Install Redis locally OR get cloud Redis URL
- [ ] Copy `.env.example` to `.env` and fill in values
- [ ] Copy `backend/.env.example` to `backend/.env` and fill in values
- [ ] Copy `web/.env.example` to `web/.env.local` and fill in values
- [ ] Run database migrations with `npm run migrate`
- [ ] Test backend with `npm run dev`
- [ ] Test frontend with `cd web && npm run dev`

---

## 🔑 Generating Secure Secrets

### JWT Secret
```bash
# Generate a secure random string (PowerShell)
$bytes = New-Object Byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Or use an online tool: https://randomkeygen.com/

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **Twilio Docs**: https://www.twilio.com/docs
- **Groq Docs**: https://console.groq.com/docs
- **Redis Docs**: https://redis.io/docs
- **Next.js Environment Variables**: https://nextjs.org/docs/app/building-your-application/configuring/environment-variables

---

## 🐛 Troubleshooting

### "Invalid Supabase credentials"
- Verify URL format includes `https://` and ends with `.supabase.co`
- Check that you're using the correct key (anon vs service role)
- Ensure no extra spaces or quotes in the `.env` file

### "Twilio authentication failed"
- Verify Account SID starts with `AC`
- Check Auth Token is exactly 32 characters
- Ensure phone number includes country code (e.g., `+1`)

### "Redis connection refused"
- For local: Make sure Redis server is running (`redis-server`)
- For cloud: Verify Redis URL format and credentials

### "Groq API rate limit"
- Free tier has rate limits
- Try using a slower model or upgrade plan
- Implement request queuing/throttling

---

**Last Updated:** September 2026
