# 🎯 CallPulse - Quick Reference Card

## 🔑 Where to Get API Keys

| Service | URL | What You Need | Cost |
|---------|-----|---------------|------|
| **Supabase** | https://supabase.com/dashboard | URL, anon key, service_role key | FREE (500MB database) |
| **Twilio** | https://console.twilio.com | Account SID, Auth Token, Phone # | FREE trial ($15 credit) |
| **Groq** | https://console.groq.com | API Key | 100% FREE |
| **JWT** | Generate locally | 64-char hex string | FREE |

---

## 📁 Files You Need to Create

### `backend\.env`
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890
GROQ_API_KEY=gsk_...
JWT_SECRET=your-generated-secret
```

### `web\.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:5050
```

---

## ⚡ Essential Commands

### First Time Setup
```powershell
# 1. Install dependencies (already done ✅)
cd backend ; npm install
cd ..\web ; npm install

# 2. Validate your setup
.\validate-setup.ps1

# 3. Run Supabase SQL migration
# Open: https://supabase.com/dashboard
# Go to: SQL Editor → New Query
# Paste content from: supabase\migrations\001_initial_schema.sql
# Click: Run
```

### Start Development
```powershell
# Terminal 1: Backend
cd backend
npm run dev
# ✅ Server on http://localhost:5050

# Terminal 2: Frontend (new window)
cd web
npm run dev
# ✅ App on http://localhost:3000
```

### Verify Everything Works
```powershell
# Run automated validation
.\validate-setup.ps1

# Or manually test:
# 1. Backend health: http://localhost:5050/api/v1/health
# 2. Frontend: http://localhost:3000
# 3. Create account and sign in
```

---

## 🔍 Quick Checks

### ✅ Backend is Healthy
Open: http://localhost:5050/api/v1/health

**Expected:**
```json
{"status": "healthy", "timestamp": "..."}
```

### ✅ Frontend is Running
Open: http://localhost:3000

**Expected:**
- Dark navy landing page
- "CallPulse" logo
- Sign in/Sign up buttons

### ✅ Database is Setup
Sign up for account → Should succeed without errors

---

## 🐛 Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| `SUPABASE_URL is required` | Create `backend\.env` with all keys |
| Backend won't start | Check backend\.env exists and has valid keys |
| Frontend shows errors | Check web\.env.local exists |
| "relation does not exist" | Run SQL migration in Supabase dashboard |
| Can't sign up | Verify Supabase keys are correct |
| API calls fail | Confirm backend is running on port 5050 |

---

## 📊 Port Reference

| Service | Port | URL |
|---------|------|-----|
| Backend API | 5050 | http://localhost:5050 |
| Frontend | 3000 | http://localhost:3000 |
| Redis (optional) | 6379 | localhost:6379 |

---

## 🎨 VirtualPBX Theme Colors

```css
Background: #1a2332 (dark navy)
Card: #242e3f
Accent: #0ea5e9 (cyan/teal)
Success: #10b981
Warning: #f59e0b
Error: #ef4444
```

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `SETUP_NOW.md` | **START HERE** - Complete setup guide |
| `QUICK_REFERENCE.md` | This file - Quick commands |
| `docs/LOCAL_SETUP_GUIDE.md` | Detailed local setup |
| `docs/DEPLOYMENT.md` | Production deployment guide |
| `docs/openapi.yaml` | API documentation |
| `README.md` | Project overview |

---

## 🚀 Testing Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Health check returns "healthy"
- [ ] Can access http://localhost:3000
- [ ] Can create new account
- [ ] Can sign in
- [ ] Dashboard loads with metrics
- [ ] Sidebar navigation works
- [ ] Can navigate to all pages

---

## 🔄 Development Workflow

1. **Make changes** to code
2. **Backend auto-reloads** (Fastify watch mode)
3. **Frontend auto-reloads** (Next.js hot reload)
4. **Check browser** for changes
5. **Check terminal** for errors

---

## 🧪 Testing Voice/SMS (Requires Public URL)

Local testing works for dashboard only. For phone calls/SMS:

1. **Use ngrok** to expose local backend:
   ```powershell
   ngrok http 5050
   ```

2. **Update Twilio webhooks**:
   - Voice URL: `https://xxxxx.ngrok.io/api/v1/webhooks/voice/incoming`
   - SMS URL: `https://xxxxx.ngrok.io/api/v1/webhooks/sms/incoming`

---

## 💡 Pro Tips

- ✅ Groq is FREE and fast (no credit card needed)
- ✅ Twilio gives $15 free trial credit
- ✅ Redis is optional (system works without it)
- ✅ Check browser console (F12) for frontend errors
- ✅ Check terminal logs for backend errors
- ✅ Use Supabase dashboard to view database directly

---

## 📞 Need Help?

1. Run `.\validate-setup.ps1` to diagnose issues
2. Check SETUP_NOW.md for detailed instructions
3. Verify all environment variables are set
4. Confirm SQL migration ran successfully
5. Check terminal logs for error messages

---

**Happy coding! 🎉**
