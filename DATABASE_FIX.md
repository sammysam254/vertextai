# 🔧 Database Migration - Fixed Version

## Problem
The original migration failed with: `ERROR: 42501: permission denied for schema auth`

## Solution
Use the **fixed migration file** that removes auth schema dependencies.

---

## 🚀 Run This Migration Instead

### Step 1: Open Supabase SQL Editor
1. Go to: https://supabase.com/dashboard/project/cnezekhsnitmhptzlfys
2. Click "SQL Editor" in left sidebar
3. Click "New Query"

### Step 2: Use the Fixed Migration
1. Open this file on your computer: 
   ```
   c:\callcenter\supabase\migrations\001_initial_schema_fixed.sql
   ```
2. Select ALL the text (Ctrl+A)
3. Copy it (Ctrl+C)

### Step 3: Run in Supabase
1. Paste into the SQL Editor (Ctrl+V)
2. Click **"Run"** button (bottom right)
3. Wait for success message

### Expected Result
```
✅ CallPulse Database Schema installed successfully!

Tables created: 6
  • organizations
  • contacts
  • communications
  • messages
  • call_transcripts
  • audit_logs

Indexes: 25+
Views: 2

🎉 Database is ready! You can now use CallPulse.
```

---

## ✅ Verify Success

### Check Tables Created
1. Click "Table Editor" in left sidebar
2. You should see these 6 tables:
   - ✅ `organizations`
   - ✅ `contacts`
   - ✅ `communications`
   - ✅ `messages`
   - ✅ `call_transcripts`
   - ✅ `audit_logs`

### Test Backend Health
Open: http://localhost:5050/api/v1/health

**Before migration:** 
```json
{"database": {"status": "down"}}
```

**After migration:**
```json
{"database": {"status": "up"}}
```

---

## 📋 What's Different in the Fixed Version?

The fixed migration removes:
- ❌ `organization_members` table (references `auth.users`)
- ❌ `auth.user_organizations()` function (requires auth schema access)
- ❌ Row Level Security (RLS) policies (require auth schema access)

**Note:** RLS will be handled by the backend API using `service_role` key for now. For production, you can add RLS policies later via the Supabase dashboard with proper permissions.

---

## 🎯 What Gets Created

### 1. Organizations Table
Stores company/tenant information, Twilio config, AI settings

### 2. Contacts Table
Customer contact information per organization

### 3. Communications Table
All voice calls and SMS interactions

### 4. Messages Table
SMS message threads (MMS support)

### 5. Call Transcripts Table
Speaker-segmented voice call transcriptions

### 6. Audit Logs Table
Activity tracking for compliance

---

## 🧪 Next Steps After Migration

1. **Test Backend Health**
   ```
   http://localhost:5050/api/v1/health
   ```
   Should now show database: "up" ✅

2. **Create Your Account**
   - Go to: http://localhost:3000
   - Click "Get Started"
   - Sign up with your email

3. **Explore Dashboard**
   - Sign in
   - View the dark navy themed dashboard
   - Navigate through all pages

---

## 🐛 Still Having Issues?

### Error: "relation already exists"
**Solution:** Tables already created! This is fine, you can proceed.

### Error: "permission denied"
**Solution:** Make sure you're using the **FIXED** migration file:
`001_initial_schema_fixed.sql` (NOT the original `001_initial_schema.sql`)

### Database still shows "down"
1. Verify tables were created in Table Editor
2. Check backend logs for specific error
3. Restart backend: Stop and run `npm run dev` again

---

## ✅ Success Checklist

- [ ] Fixed migration file runs without errors
- [ ] 6 tables visible in Supabase Table Editor
- [ ] Backend health check shows database: "up"
- [ ] Can create account at http://localhost:3000
- [ ] Can sign in and see dashboard

---

**Ready to continue? Run the fixed migration now! 🚀**
