# 🚀 CallPulse - START HERE

## What You Need to Provide (API Keys)

Before running CallPulse locally, you need **4 free API keys**:

### 1. Supabase (Database) - 5 min setup
- **URL**: [supabase.com](https://supabase.com)
- **What you need**:
  - `SUPABASE_URL` (Project URL)
  - `SUPABASE_SERVICE_ROLE_KEY` (Service role key)
  - `SUPABASE_ANON_KEY` (Anon/public key)
- **Instructions**: See `LOCAL_SETUP_GUIDE.md` Step 1.1

### 2. Twilio (Phone/SMS) - 10 min setup
- **URL**: [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
- **What you need**:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER` (free trial number)
- **Instructions**: See `LOCAL_SETUP_GUIDE.md` Step 1.2

### 3. Groq (AI) - 2 min setup
- **URL**: [console.groq.com](https://console.groq.com)
- **What you need**:
  - `GROQ_API_KEY`
- **Instructions**: See `LOCAL_SETUP_GUIDE.md` Step 1.3

### 4. JWT Secret (Generated)
- **What you need**:
  - `JWT_SECRET` (any random 32+ character string)
- **Example**: `my-super-secret-jwt-key-12345678901234567890`

---

## Quick Start (After Getting Keys)

### 1. Install Dependencies

```powershell
# Backend
cd backend
npm install

# Frontend  
cd ../web
npm install
```

### 2. Configure Environment

**Create `backend/.env`**:
```env
NODE_ENV=development
PORT=5050
BASE_URL=http://localhost:5050

# Paste your Supabase keys here
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional Redis (or skip for graceful degradation)
REDIS_HOST=localhost
REDIS_PORT=6379

# Paste your Twilio keys here
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1555xxx

# Paste your Groq key here
GROQ_API_KEY=gsk_xxx
GROQ_MODEL=llama-3.1-8b-instant

# Generate a random 32+ character string
JWT_SECRET=your-32-char-secret-key-here

LOG_LEVEL=debug
```

**Create `web/.env.local`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:5050
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run Setup Migration (Supabase SQL)

1. Go to your Supabase project dashboard
2. Click "SQL Editor"
3. Click "New query"
4. Copy ALL content from `supabase/migrations/001_initial_schema.sql`
5. Paste and click "Run"
6. Should see "Success. No rows returned"

### 4. Start Services

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```

Wait for: `[INFO] Server listening at http://localhost:5050`

**Terminal 2 - Frontend:**
```powershell
cd web
npm run dev
```

Wait for: `Ready on http://localhost:3000`

### 5. Test

Open browser: **http://localhost:3000**

Should see:
- Dark navy landing page
- "CallPulse" logo with phone icon
- "Sign In" and "Get Started" buttons

---

## Verification Commands

```powershell
# Test backend health
curl http://localhost:5050/api/v1/health

# Should return:
# {"status":"healthy" or "degraded"}

# Test root endpoint
curl http://localhost:5050/

# Should return:
# {"name":"CallPulse API","version":"1.0.0","status":"online"}
```

---

## Automated Setup Script

Run this to verify everything:

```powershell
.\setup-and-test.ps1
```

This checks:
- ✓ Node.js version
- ✓ Dependencies installed
- ✓ Environment files exist
- ✓ Redis connection (optional)
- ✓ Backend compiles (0 TypeScript errors)
- ✓ Backend builds successfully  
- ✓ Frontend builds successfully

---

## What to Expect

### Backend (port 5050)
- Fastify server with TypeScript
- Redis caching (optional - graceful degradation if missing)
- Supabase PostgreSQL connection
- Twilio webhook endpoints
- Groq AI integration

### Frontend (port 3000)
- Next.js 14 with App Router
- Dark navy VirtualPBX theme
- Dashboard with 15+ pages
- Real-time metrics & charts
- Mobile responsive

---

## Directory Structure

```
callcenter/
├── backend/          # Fastify API server
│   ├── src/         # Source code
│   ├── .env         # ← CREATE THIS (your API keys)
│   └── package.json
│
├── web/             # Next.js dashboard
│   ├── app/         # App Router pages
│   ├── src/         # Components & utilities
│   ├── .env.local   # ← CREATE THIS (frontend config)
│   └── package.json
│
├── supabase/        # Database migrations
│   └── migrations/
│       └── 001_initial_schema.sql  # ← RUN THIS in Supabase
│
└── docs/            # Documentation
    ├── DEPLOYMENT.md          # Production deploy guide
    ├── LOCAL_SETUP_GUIDE.md  # Detailed local setup
    └── api/
        └── openapi.yaml       # API documentation
```

---

## Common Issues

### "Configuration validation failed"
- **Fix**: Check all required env vars are in `backend/.env`
- **Required**: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, JWT_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

### "Redis connection error"
- **Fix**: Either install Redis OR skip it (system works without Redis)
- **To skip**: Don't set REDIS_URL/REDIS_HOST in backend/.env

### "Cannot find module"
- **Fix**: Run `npm install` in both backend/ and web/ directories

### "Port 5050 already in use"
- **Fix**: Kill process using port or change PORT in backend/.env

---

## Next Steps

After local testing works:

1. **Explore Dashboard**: Navigate all pages, test features
2. **Add Test Data**: Create contacts, test dialer
3. **Test Webhooks**: Use ngrok for real Twilio calls/SMS
4. **Deploy**: Follow `docs/DEPLOYMENT.md` for production

---

## Documentation

- **Quick Start**: `QUICK_START.md` (TL;DR version)
- **Detailed Setup**: `LOCAL_SETUP_GUIDE.md` (step-by-step)
- **Deployment**: `docs/DEPLOYMENT.md` (production guide)
- **API Docs**: `docs/api/openapi.yaml` (OpenAPI spec)
- **Project Summary**: `COMPLETION_REPORT.md` (full overview)

---

## Get Help

If you're stuck:

1. Check `LOCAL_SETUP_GUIDE.md` for detailed troubleshooting
2. Verify all API keys are correct and not expired
3. Check backend logs for specific error messages
4. Ensure ports 3000 and 5050 are not in use

---

## ✅ Success Checklist

Before considering setup complete:

- [ ] Got all 4 API keys (Supabase, Twilio, Groq, JWT Secret)
- [ ] Created `backend/.env` with all keys
- [ ] Created `web/.env.local` with frontend config
- [ ] Ran Supabase migration SQL
- [ ] Backend starts without errors (`npm run dev`)
- [ ] Frontend starts without errors (`npm run dev`)
- [ ] Health check returns `{"status":"healthy"}`
- [ ] Can open `http://localhost:3000` in browser
- [ ] Can see dark navy CallPulse landing page
- [ ] Can sign up and see dashboard

---

**Time to Complete**: 20-30 minutes (including getting API keys)

**Total Cost**: $0 (all free tiers)

**Ready to start?** Open `LOCAL_SETUP_GUIDE.md` and follow Step 1!
