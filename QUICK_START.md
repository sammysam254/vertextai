# CallPulse - Quick Start (TL;DR)

## Fast Local Setup - 15 Minutes

### 1. Get API Keys (10 min)

**Supabase** (database):
- Go to [supabase.com](https://supabase.com) → New Project
- Run SQL from `supabase/migrations/001_initial_schema.sql`
- Copy: Project URL + Service Role Key

**Twilio** (phone):
- Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
- Get trial phone number
- Copy: Account SID + Auth Token + Phone Number

**Groq** (AI):
- Go to [console.groq.com](https://console.groq.com)
- Create API Key
- Copy: API Key

### 2. Install & Configure (2 min)

```bash
# Install everything
npm install
cd backend && npm install
cd ../web && npm install
cd ..

# Start Redis (optional)
docker run -d -p 6379:6379 redis:7-alpine
```

Create `backend/.env`:
```env
NODE_ENV=development
PORT=5050
BASE_URL=http://localhost:5050

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

REDIS_HOST=localhost
REDIS_PORT=6379

TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1555xxx

GROQ_API_KEY=gsk_xxx
GROQ_MODEL=llama-3.1-8b-instant

JWT_SECRET=your-32-char-secret-key-here
LOG_LEVEL=debug
```

Create `web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5050
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### 3. Run (1 min)

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd web
npm run dev
```

### 4. Test

- Open: `http://localhost:3000`
- Click "Sign Up"
- Create account
- Explore dashboard!

### 5. Test Phone/SMS (Optional)

```bash
# Terminal 3 - ngrok
ngrok http 5050
```

Configure Twilio webhooks with ngrok URL:
- Voice: `https://xxx.ngrok.io/api/v1/voice/incoming`
- SMS: `https://xxx.ngrok.io/api/v1/sms/incoming`

Call/text your Twilio number → AI responds!

---

## Verification Checklist

```bash
# Backend health
curl http://localhost:5050/api/v1/health
# Should return: {"status":"healthy"}

# Frontend
# Open http://localhost:3000
# Should see dark navy dashboard
```

---

**Done!** System is running locally. 

For detailed troubleshooting, see `LOCAL_SETUP_GUIDE.md`
