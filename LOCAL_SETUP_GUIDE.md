# CallPulse - Local Setup & Testing Guide

## 🎯 Goal

Get CallPulse running locally with all services connected and test everything before deployment.

---

## 📋 Prerequisites Checklist

Before starting, you'll need accounts and API keys from:

- [ ] **Supabase** (Free tier) - Database
- [ ] **Twilio** (Trial account) - Voice/SMS  
- [ ] **Groq** (Free tier) - AI inference
- [ ] **Docker Desktop** (Optional) - For local Redis

---

## Step 1: Get Your API Keys

### 1.1 Supabase Setup (5 minutes)

1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" (sign up with GitHub)
3. Create new organization (free)
4. Click "New Project"
   - **Name**: `callpulse-local`
   - **Database Password**: Generate strong password (save it!)
   - **Region**: Choose closest to you
   - Click "Create new project" (wait 2-3 minutes)

5. **Run Database Migration**:
   - Click "SQL Editor" in left sidebar
   - Click "New query"
   - Copy entire content from `supabase/migrations/001_initial_schema.sql`
   - Paste and click "Run"
   - Should see "Success. No rows returned"

6. **Get Your Keys**:
   - Click "Settings" (gear icon) → "API"
   - Copy these values:
     - **Project URL**: `https://xxx.supabase.co`
     - **anon/public key**: `eyJhbGciOiJI...` (starts with eyJ)
     - **service_role key**: `eyJhbGciOiJI...` (different from anon)

### 1.2 Twilio Setup (10 minutes)

1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (verify phone and email)
3. **Get Trial Phone Number**:
   - Dashboard will prompt "Get a Trial Phone Number"
   - Click "Get a trial phone number"
   - Accept the number assigned
   - **Save this number** (e.g., `+15551234567`)

4. **Get Credentials**:
   - From Console Dashboard:
     - **Account SID**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
     - **Auth Token**: Click "Show" and copy

5. **Note**: Trial account limitations:
   - Can only call/text verified numbers
   - Click "Verified Caller IDs" to add your phone

### 1.3 Groq API Setup (2 minutes)

1. Go to [console.groq.com](https://console.groq.com)
2. Sign in with Google/GitHub
3. Click "API Keys" in left sidebar
4. Click "Create API Key"
5. **Name**: `callpulse-local`
6. Copy the key: `gsk_xxxxxxxxxxxxxxxxxxxxx`
7. **Save immediately** (shown only once!)

---

## Step 2: Install Dependencies

### 2.1 Install Redis (Choose ONE option)

**Option A: Docker (Recommended)**
```bash
# Install Docker Desktop from docker.com
# Then run:
docker run -d -p 6379:6379 --name callpulse-redis redis:7-alpine
```

**Option B: Windows Native**
```bash
# Download from: https://github.com/microsoftarchive/redis/releases
# Or use Chocolatey:
choco install redis-64
redis-server
```

**Option C: Skip Redis (Graceful Degradation)**
- System will work without Redis (slower, no caching)
- Just don't set REDIS_URL in .env

### 2.2 Install Project Dependencies

```bash
# Install root workspace dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../web
npm install

# Return to root
cd ..
```

---

## Step 3: Configure Environment Variables

### 3.1 Backend Configuration

Create `backend/.env`:

```bash
# Copy the example file
cp backend/.env.example backend/.env
```

Now edit `backend/.env` with your keys:

```env
# Environment
NODE_ENV=development
PORT=5050
BASE_URL=http://localhost:5050

# Supabase (from Step 1.1)
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis (if using Docker from Step 2.1)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=  # Leave empty for local
# Or if you skipped Redis, just comment all REDIS_* vars

# Twilio (from Step 1.2)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# Groq AI (from Step 1.3)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant

# Security (generate random 32+ character string)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long-change-this

# Logging
LOG_LEVEL=debug
MASK_PII_IN_LOGS=false

# Cache TTLs (optional, has defaults)
CACHE_ORG_TTL=86400
CACHE_CALL_TTL=7200
CACHE_SMS_TTL=3600
```

### 3.2 Frontend Configuration

Create `web/.env.local`:

```bash
# Copy example
cp web/.env.example web/.env.local
```

Edit `web/.env.local`:

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:5050

# Supabase (use anon key, NOT service role!)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 4: Test Backend

```bash
cd backend

# Test TypeScript compilation
npm run typecheck
# Should output: No errors ✅

# Test build
npm run build
# Should complete without errors ✅

# Start development server
npm run dev
```

You should see:
```
[INFO] ✓ Redis connected successfully
[INFO] ✓ Redis ready to accept commands
[INFO] Server listening at http://localhost:5050
```

### 4.1 Test Health Check

Open new terminal:
```bash
curl http://localhost:5050/api/v1/health
```

Should return:
```json
{
  "status": "healthy",
  "services": {
    "redis": { "status": "up", "latency": 2 },
    "database": { "status": "up" }
  }
}
```

### 4.2 Test Root Endpoint

```bash
curl http://localhost:5050/
```

Should return:
```json
{
  "name": "CallPulse API",
  "version": "1.0.0",
  "status": "online"
}
```

**✅ Backend is working!** Keep it running.

---

## Step 5: Test Frontend

Open **new terminal**:

```bash
cd web

# Build check
npm run build
# Should complete successfully ✅

# Start dev server
npm run dev
```

You should see:
```
▲ Next.js 14.1.0
- Local:        http://localhost:3000
- Ready in 2.3s
```

### 5.1 Test in Browser

1. Open browser: `http://localhost:3000`
2. Should see CallPulse landing page with dark navy theme
3. Click "Sign In" → Should go to `/login`
4. Try logging in (will create account if not exists)

---

## Step 6: Create Test Account

### Option A: Via Frontend Signup

1. Go to `http://localhost:3000/signup`
2. Fill in:
   - **Organization Name**: My Test Org
   - **Phone Number**: Your Twilio number from Step 1.2
   - **Email**: your@email.com
   - **Password**: test1234
3. Click "Create Account"
4. Should redirect to `/dashboard`

### Option B: Via Supabase SQL

Go to Supabase SQL Editor and run:

```sql
-- Insert test organization
INSERT INTO organizations (
  name,
  twilio_account_sid,
  twilio_auth_token,
  twilio_phone_number,
  ai_system_prompt
) VALUES (
  'Test Organization',
  'ACxxxxxxxxxxxxxxxx',  -- Your Twilio Account SID
  'your_auth_token',      -- Your Twilio Auth Token
  '+15551234567',         -- Your Twilio Phone Number
  'You are a professional call center assistant. Be helpful, concise, and friendly.'
) RETURNING id;

-- Note the returned ID, you'll use it for testing
```

---

## Step 7: Test Dashboard Features

With frontend still running at `http://localhost:3000/dashboard`:

### 7.1 Overview Page ✅
- Should see 4 metric cards (Queue Waiting Time, Lost Calls Rate, etc.)
- Performance chart with teal/cyan gradients
- Active Queues panel
- Agent Performance cards

### 7.2 Calls Page ✅
- Click "CALLS" in sidebar
- Should see call log table (may be empty)
- Test filters and search

### 7.3 Inbox Page ✅
- Click "INBOX" in sidebar
- Should see two-pane layout
- Left: Contact list
- Right: Message stream

### 7.4 Contacts Page ✅
- Click "CONTACTS" in sidebar
- Click "Add Contact" button
- Fill form and submit
- Should see contact in table

### 7.5 Dialer Page ✅
- Click "DIALER" in sidebar
- Test numeric keypad (click digits)
- Should populate phone number field

### 7.6 Settings Pages ✅
- Click "SETTINGS" in sidebar
- Test each settings page:
  - AI Configuration
  - Voice Models
  - Twilio Credentials
  - Escalation Rules

---

## Step 8: Test Twilio Webhooks (ngrok)

To test actual phone calls/SMS, you need public URLs for webhooks.

### 8.1 Install ngrok

```bash
# Download from: https://ngrok.com/download
# Or use Chocolatey:
choco install ngrok

# Or npm:
npm install -g ngrok
```

### 8.2 Start ngrok

With backend still running on port 5050:

```bash
# In new terminal
ngrok http 5050
```

You'll see:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:5050
```

**Copy the https URL**: `https://abc123.ngrok.io`

### 8.3 Configure Twilio Webhooks

1. Go to [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click your phone number
3. **Voice Configuration**:
   - **A CALL COMES IN**: `https://abc123.ngrok.io/api/v1/voice/incoming`
   - **METHOD**: `HTTP POST`
4. **Messaging Configuration**:
   - **A MESSAGE COMES IN**: `https://abc123.ngrok.io/api/v1/sms/incoming`
   - **METHOD**: `HTTP POST`
5. Click "Save"

### 8.4 Test Real Phone Call

1. From a verified phone number, call your Twilio number
2. Should hear: "Welcome to Test Organization"
3. Speak something like: "Hello, I need help"
4. AI should respond within 500ms
5. Check backend logs for:
   ```
   [INFO] Incoming call from +1555...
   [INFO] Groq API call completed (duration: 347ms)
   ```

### 8.5 Test Real SMS

1. Send SMS to your Twilio number: "Hello"
2. Should receive AI response within 1-2 seconds
3. Check backend logs
4. Check Dashboard → Inbox (should see conversation)

---

## Step 9: Run Tests

```bash
# Backend tests
cd backend
npm test

# Note: Some tests may fail without Redis
# That's OK - system has graceful degradation
```

---

## ✅ Success Checklist

Before deploying to production, verify:

- [ ] Backend starts without errors
- [ ] Health check returns `"status": "healthy"`
- [ ] Frontend builds successfully
- [ ] Dashboard loads at `http://localhost:3000`
- [ ] Can create account and login
- [ ] All dashboard pages render correctly
- [ ] Can add/edit contacts
- [ ] Dialer keypad works
- [ ] Settings pages load
- [ ] (Optional) Real phone call works with ngrok
- [ ] (Optional) Real SMS works with ngrok

---

## 🐛 Troubleshooting

### "Redis connection error"

**Solution**: 
- If using Docker: `docker ps` (check Redis is running)
- If skipped Redis: Comment out all `REDIS_*` vars in backend/.env
- System will work without Redis (graceful degradation)

### "Configuration validation failed"

**Solution**:
- Check all required env vars are set in backend/.env
- Especially: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, JWT_SECRET
- JWT_SECRET must be at least 32 characters

### "Cannot find module '@/lib/utils'"

**Solution**:
```bash
cd web
npm install
npm run build
```

### Twilio webhooks return 403 Forbidden

**Solution**:
- Twilio signature validation requires correct URL
- Make sure ngrok URL matches exactly
- Check TWILIO_AUTH_TOKEN is correct

### Frontend can't connect to backend

**Solution**:
- Verify backend is running on port 5050
- Check `NEXT_PUBLIC_API_URL=http://localhost:5050` in web/.env.local
- Check browser console for CORS errors

---

## 📊 Expected Performance

When everything is running correctly:

- **Backend startup**: ~2 seconds
- **Frontend build**: ~30 seconds
- **Page loads**: <500ms
- **AI voice response**: <500ms (with Groq)
- **SMS AI reply**: <2 seconds
- **Cache hit latency**: <2ms
- **Database query**: <50ms

---

## 🎯 Next Steps

Once everything works locally:

1. **Review**: Check all features work as expected
2. **Deploy**: Follow `docs/DEPLOYMENT.md` for production
3. **Monitor**: Set up monitoring and alerts
4. **Scale**: Adjust resources based on usage

---

## 📞 Need Help?

If you encounter issues:

1. Check backend logs: Look for ERROR messages
2. Check browser console: Look for network errors
3. Verify all API keys are correct
4. Ensure all services (Redis, Supabase) are accessible
5. Check firewall isn't blocking ports 3000, 5050, 6379

---

**Status**: Ready for local testing! 🚀

Follow each step carefully and check off items as you complete them.
