# 🚀 CallPulse - Local Testing Setup

## ✅ What's Already Done
- ✅ All 24 tasks completed
- ✅ Backend compiled (0 TypeScript errors)
- ✅ Frontend compiled (0 errors)
- ✅ All dependencies installed
- ✅ 80+ files created (~15,000 LOC)

---

## 🔑 Step 1: Get Your API Keys (15 minutes)

### Supabase (Database + Auth)
1. Go to https://supabase.com/dashboard
2. Click **"New Project"**
3. Choose a name (e.g., "callpulse-dev")
4. Wait 2 minutes for setup
5. Go to **Settings → API**
6. Copy these 3 values:
   - `URL` (looks like: https://xxxxx.supabase.co)
   - `anon public` key (starts with: eyJ...)
   - `service_role secret` key (starts with: eyJ...)

### Twilio (Phone System)
1. Go to https://console.twilio.com/us1/develop/sms/try-it-out/send-an-sms
2. Sign up (free trial gives you $15 credit)
3. From the dashboard, copy:
   - `Account SID` (starts with: AC...)
   - `Auth Token` (click "show" to reveal)
4. Click **"Get a Trial Number"** (free)
5. Copy the phone number (format: +1234567890)

### Groq (AI - 100% FREE!)
1. Go to https://console.groq.com
2. Sign up with Google/GitHub
3. Click **"API Keys"** in left menu
4. Click **"Create API Key"**
5. Copy the key (starts with: gsk_...)

### Generate JWT Secret
Open PowerShell and run:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (64-character hex string)

---

## 📝 Step 2: Create Environment Files

### Backend Environment (.env)
Create file: `backend\.env`

```env
# Server
NODE_ENV=development
PORT=5050
FRONTEND_URL=http://localhost:3000

# Supabase (PASTE YOUR VALUES HERE)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
SUPABASE_ANON_KEY=eyJhbGciOi...

# Twilio (PASTE YOUR VALUES HERE)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# Groq AI (PASTE YOUR KEY HERE)
GROQ_API_KEY=gsk_...

# JWT (PASTE GENERATED SECRET HERE)
JWT_SECRET=your-64-char-hex-string-here

# Redis (Optional - leave as-is for now)
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=info
```

### Frontend Environment (.env.local)
Create file: `web\.env.local`

```env
# Supabase (PASTE SAME VALUES FROM BACKEND)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:5050
```

---

## 🗄️ Step 3: Setup Database

1. Open Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in left menu
4. Click **"New Query"**
5. Open the file: `supabase\migrations\001_initial_schema.sql`
6. Copy ALL the SQL code
7. Paste into Supabase SQL Editor
8. Click **"Run"** (bottom right)
9. Wait for "Success" message

---

## ▶️ Step 4: Start Backend

Open PowerShell in the project folder:

```powershell
cd backend
npm run dev
```

**Expected output:**
```
[INFO] Server listening on http://0.0.0.0:5050
[INFO] Health check available at: http://localhost:5050/api/v1/health
```

Leave this terminal running!

---

## ▶️ Step 5: Start Frontend (New Terminal)

Open a NEW PowerShell window:

```powershell
cd web
npm run dev
```

**Expected output:**
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

Leave this terminal running too!

---

## ✅ Step 6: Verify Everything Works

### Test #1: Backend Health Check
Open browser: http://localhost:5050/api/v1/health

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-09-15T...",
  "redis": {
    "connected": false,
    "message": "Redis not configured..."
  }
}
```
✅ Status "healthy" = Backend works!

### Test #2: Frontend
Open browser: http://localhost:3000

**Expected:**
- Dark navy landing page
- "CallPulse" logo
- "Sign In" and "Get Started" buttons

### Test #3: Create Account
1. Click **"Get Started"**
2. Fill in email/password
3. Click **"Sign Up"**
4. Check your email for Supabase confirmation
5. Click confirmation link
6. Sign in

### Test #4: Dashboard
After sign-in, you should see:
- Dark navy dashboard (#1a2332 background)
- Sidebar with Overview, Calls, Inbox, etc.
- Top metrics (Total Calls, Active Agents, etc.)
- Charts with teal/cyan gradients

---

## 🔧 Optional: Run Automated Tests

We created a PowerShell test script. Run it:

```powershell
.\setup-and-test.ps1
```

This will:
- ✅ Check all .env files exist
- ✅ Test backend health endpoint
- ✅ Test Supabase connection
- ✅ Test Twilio credentials
- ✅ Test Groq API
- ✅ Verify Redis (optional)

---

## 🐛 Troubleshooting

### Backend won't start
**Error:** `SUPABASE_URL is required`
- **Fix:** Make sure `backend\.env` file exists with all keys filled in

### Frontend shows blank page
**Error:** Console shows "Failed to fetch"
- **Fix:** Make sure backend is running on port 5050
- Check `web\.env.local` has correct `NEXT_PUBLIC_API_URL=http://localhost:5050`

### Database errors
**Error:** "relation does not exist"
- **Fix:** Run the SQL migration again in Supabase SQL Editor

### Twilio webhook errors (expected for now)
- Twilio webhooks need a public URL (won't work on localhost)
- We'll configure ngrok or deploy to Render for testing calls/SMS

---

## ✅ Success Checklist

- [ ] Got all API keys (Supabase, Twilio, Groq)
- [ ] Created `backend\.env` with all keys
- [ ] Created `web\.env.local` with Supabase keys
- [ ] Ran SQL migration in Supabase
- [ ] Backend starts on http://localhost:5050
- [ ] Frontend starts on http://localhost:3000
- [ ] Health check returns `"status": "healthy"`
- [ ] Can create account and sign in
- [ ] Dashboard loads with dark navy theme

---

## 🚀 Next Steps After Local Testing

Once everything works locally:

1. **Test Voice Calls (need public URL)**
   - Use ngrok: `ngrok http 5050`
   - Configure Twilio webhook to ngrok URL

2. **Deploy to Production**
   - Follow `docs/DEPLOYMENT.md`
   - Deploy to Render.com (managed hosting)
   - Configure production Twilio webhooks

3. **Invite Team Members**
   - Create organization in dashboard
   - Add agents via Settings → Team

---

## 📚 Documentation Reference

- **Full Setup Guide:** `docs/LOCAL_SETUP_GUIDE.md`
- **API Reference:** `docs/openapi.yaml`
- **Deployment Guide:** `docs/DEPLOYMENT.md`
- **Project Overview:** `README.md`

---

## 💡 Pro Tips

1. **Redis is optional** - System works without it (uses in-memory cache fallback)
2. **Use Twilio trial** - Free $15 credit for testing
3. **Groq is FREE** - No credit card required, faster than OpenAI
4. **Test locally first** - Don't deploy until everything works on localhost
5. **Check logs** - Backend shows detailed logs in terminal

---

## Need Help?

If you get stuck:
1. Check the error message in terminal
2. Look at browser console (F12 → Console tab)
3. Verify all environment variables are set correctly
4. Make sure Supabase SQL migration ran successfully
5. Confirm backend health check returns "healthy"

---

**You're almost there! Just get those API keys and you'll be running CallPulse locally in 20 minutes! 🎉**
