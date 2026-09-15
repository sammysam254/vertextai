# CallPulse Deployment Guide

## Overview

This guide covers deploying CallPulse to production using Render.com for hosting and managed services.

---

## Prerequisites

- GitHub account with repository access
- Render.com account
- Supabase account
- Twilio account with phone number
- Groq API key

---

## 1. Supabase Setup

### Create Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and set project name: `callpulse-prod`
4. Select region closest to your users
5. Generate strong database password and save it

### Run Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### Get Credentials

From Supabase Dashboard > Settings > API:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: Anon/Public key  
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (keep secret!)

---

## 2. Twilio Configuration

### Purchase Phone Number

1. Go to [twilio.com/console](https://twilio.com/console)
2. Buy a phone number with Voice and SMS capabilities
3. Note the phone number in E.164 format: `+15550000`

### Get Credentials

From Twilio Console:
- `TWILIO_ACCOUNT_SID`: Account SID
- `TWILIO_AUTH_TOKEN`: Auth Token

### Configure Webhooks (after deployment)

Voice Configuration:
- **A Call Comes In**: `https://your-app.onrender.com/api/v1/voice/incoming` (HTTP POST)
- **Status Callback URL**: `https://your-app.onrender.com/api/v1/voice/status` (HTTP POST)

Messaging Configuration:
- **A Message Comes In**: `https://your-app.onrender.com/api/v1/sms/incoming` (HTTP POST)
- **Status Callback URL**: `https://your-app.onrender.com/api/v1/sms/status` (HTTP POST)

---

## 3. Groq API Setup

1. Sign up at [console.groq.com](https://console.groq.com)
2. Create API key
3. Copy `GROQ_API_KEY`

---

## 4. Backend Deployment (Render Web Service)

### Create Web Service

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:

**Basic Settings:**
- **Name**: `callpulse-api`
- **Region**: Oregon (or closest to users)
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: Starter ($7/month)

**Environment Variables:**

```bash
NODE_ENV=production
PORT=5050
BASE_URL=https://callpulse-api.onrender.com

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJI...

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15550000

# Groq AI
GROQ_API_KEY=gsk_xxxxx
GROQ_MODEL=llama-3.1-8b-instant

# Security
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Redis (from Render Redis service)
REDIS_URL=redis://red-xxxxx:6379

# Optional: Logging
LOG_LEVEL=info
MASK_PII_IN_LOGS=true
```

### Create Redis Instance

1. In Render Dashboard → "New +" → "Redis"
2. **Name**: `callpulse-redis`
3. **Plan**: Starter (512MB, $10/month)
4. **Region**: Same as web service
5. After creation, copy **Internal Redis URL**
6. Add to backend environment as `REDIS_URL`

### Deploy

1. Click "Create Web Service"
2. Wait for build to complete (~5 minutes)
3. Check logs for errors
4. Visit `https://callpulse-api.onrender.com/api/v1/health`
5. Should return: `{"status":"healthy"}`

---

## 5. Frontend Deployment (Render Static Site)

### Build Configuration

1. Update `web/next.config.js`:

```javascript
const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};
```

### Create Static Site

1. Render Dashboard → "New +" → "Static Site"
2. Connect repository
3. Configure:

**Basic Settings:**
- **Name**: `callpulse-web`
- **Branch**: `main`
- **Root Directory**: `web`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `out`

**Environment Variables:**

```bash
NEXT_PUBLIC_API_URL=https://callpulse-api.onrender.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

### Deploy

1. Click "Create Static Site"
2. Wait for build (~3 minutes)
3. Visit `https://callpulse-web.onrender.com`

---

## 6. Post-Deployment Configuration

### Update Twilio Webhooks

Now that you have public URLs, configure Twilio:

1. Go to Twilio Console → Phone Numbers → Manage → Active Numbers
2. Click your phone number
3. **Voice & Fax**:
   - A CALL COMES IN: `https://callpulse-api.onrender.com/api/v1/voice/incoming`
   - METHOD: `HTTP POST`
4. **Messaging**:
   - A MESSAGE COMES IN: `https://callpulse-api.onrender.com/api/v1/sms/incoming`
   - METHOD: `HTTP POST`
5. Save

### Create First Organization

Option A: Via Supabase SQL Editor

```sql
INSERT INTO organizations (
  name,
  twilio_account_sid,
  twilio_auth_token,
  twilio_phone_number,
  ai_system_prompt
) VALUES (
  'My Organization',
  'ACxxxxxxxx',
  'your_auth_token',
  '+15550000',
  'You are a professional call center assistant...'
);
```

Option B: Via Frontend Signup
1. Visit `https://callpulse-web.onrender.com/signup`
2. Complete registration form

---

## 7. Testing

### Test Voice

1. Call your Twilio number
2. Should hear: "Welcome to [Organization Name]"
3. Speak naturally
4. AI should respond within 500ms
5. Check dashboard for live call

### Test SMS

1. Send SMS to your Twilio number: "Hello"
2. Should receive AI response within 1-2 seconds
3. Continue conversation
4. Check Inbox page for thread

### Test Dashboard

1. Login at `https://callpulse-web.onrender.com/login`
2. Check Overview metrics
3. View Calls log
4. Check Inbox conversations
5. Test Dialer

---

## 8. Monitoring & Logs

### Render Logs

- Backend: Dashboard → callpulse-api → Logs
- Frontend: Dashboard → callpulse-web → Logs

### Health Check

Monitor endpoint: `https://callpulse-api.onrender.com/api/v1/health`

Response format:
```json
{
  "status": "healthy",
  "services": {
    "redis": { "status": "up", "latency": 2 },
    "database": { "status": "up" },
    "twilio": { "status": "up" }
  },
  "cache": {
    "hits": 1234,
    "misses": 56,
    "hitRate": 0.956
  }
}
```

### Set Up Alerts

1. Render Dashboard → callpulse-api → Settings
2. Add notification email
3. Enable:
   - Deploy failures
   - Service downtimes
   - High error rates

---

## 9. Custom Domain (Optional)

### Add Domain to Render

1. Purchase domain (e.g., callpulse.io)
2. Render → callpulse-web → Settings → Custom Domain
3. Add: `app.callpulse.io`
4. Follow DNS instructions
5. Repeat for API: `api.callpulse.io`

### Update Environment Variables

```bash
# Backend
BASE_URL=https://api.callpulse.io

# Frontend
NEXT_PUBLIC_API_URL=https://api.callpulse.io
```

### Update Twilio Webhooks

Update webhook URLs to use custom domain:
- `https://api.callpulse.io/api/v1/voice/incoming`
- `https://api.callpulse.io/api/v1/sms/incoming`

---

## 10. Scaling

### Horizontal Scaling

Render Web Service → Settings:
- Increase instance count (2-4 instances)
- Enable autoscaling based on CPU/memory

### Vertical Scaling

Upgrade plans:
- **Web Service**: Standard ($25/mo) or Pro ($85/mo)
- **Redis**: Standard (1GB, $25/mo) or Pro (4GB, $75/mo)

### Database

Supabase automatically scales. For high traffic:
- Upgrade to Pro plan ($25/mo)
- Enable read replicas

---

## Troubleshooting

### Backend won't start

1. Check environment variables are set
2. Verify Redis URL is correct
3. Check Supabase credentials
4. View Render logs for errors

### Twilio webhooks failing

1. Verify webhook URLs are publicly accessible
2. Check Twilio signature validation is working
3. Review backend logs for authentication errors
4. Test with Twilio Webhook Debugger

### Frontend can't connect to backend

1. Verify CORS settings in backend
2. Check `NEXT_PUBLIC_API_URL` is correct
3. Ensure API is running and healthy
4. Check browser console for errors

### Redis connection issues

1. Verify `REDIS_URL` environment variable
2. Check Redis instance is running
3. Ensure backend and Redis are in same region
4. Review connection pooling settings

---

## Costs Estimate (Monthly)

- **Render Web Service** (Starter): $7
- **Render Redis** (Starter 512MB): $10
- **Render Static Site**: Free
- **Supabase** (Free tier): $0
- **Twilio Phone Number**: $1
- **Twilio Usage**: Pay-as-you-go (~$0.01/min voice, $0.0075/SMS)
- **Groq API**: Free (generous limits)

**Total Fixed**: ~$18/month + usage

---

## Security Checklist

- [ ] All secrets stored in environment variables
- [ ] RLS policies enabled on Supabase
- [ ] Twilio signature validation active
- [ ] CORS properly configured
- [ ] HTTPS enforced (automatic on Render)
- [ ] JWT secrets are 32+ characters
- [ ] Service role key never exposed to frontend
- [ ] PII masking enabled in logs
- [ ] Regular dependency updates scheduled

---

## Next Steps

1. **Monitoring**: Set up Datadog, New Relic, or Sentry
2. **Backups**: Configure Supabase automated backups
3. **CI/CD**: Add GitHub Actions for automated testing
4. **Documentation**: Document organization-specific workflows
5. **Training**: Train team on dashboard usage

---

**Deployment Complete!** 🎉

Your CallPulse instance is now live and ready to handle calls and SMS.
