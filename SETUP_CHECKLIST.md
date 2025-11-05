# Backend Auth Setup Checklist

## ✅ Completed Steps

1. ✅ Installed backend dependencies (python-jose, slowapi)
2. ✅ Created middleware/auth.py for JWT verification
3. ✅ Updated backend/main.py with auth-protected endpoints
4. ✅ Updated frontend to use backend API
5. ✅ Fixed frontend loading issue in useAuth hook

## ⚠️ Action Required

### 1. Add Supabase Service Role Key

**File:** `backend/.env` (line 4)

**Current:**
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**Action:**
1. Go to https://supabase.com/dashboard/project/jjhbffulhwlidharcvhz/settings/api
2. Copy the `service_role` key (NOT the anon key)
3. Replace `your_service_role_key_here` with your actual key

**Important:** Keep this key secret! Don't commit it to Git.

---

## Testing the Implementation

### Start the Backend
```bash
cd backend
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### Start the Frontend
Open a new terminal:
```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
```

### Test the Flow

1. **Visit http://localhost:3000**
   - Should see the main page (no longer stuck on "Loading...")

2. **Sign in or create an account**
   - Go to Sign In or Sign Up

3. **Complete a typing test**
   - Type an article
   - Complete it

4. **Check browser DevTools (Network tab)**
   - Should see: `POST http://localhost:8000/api/tests` (Status: 200)
   - If you see 401 error, the service role key is missing

5. **Check Dashboard**
   - Go to Dashboard page
   - Should see: `GET http://localhost:8000/api/tests/stats` (Status: 200)

6. **Check History**
   - Go to History page
   - Should see: `GET http://localhost:8000/api/tests/history` (Status: 200)

---

## Common Issues

### Issue: "Loading..." stuck on page
**Solution:** ✅ Fixed - updated useAuth hook with try-catch

### Issue: 401 Unauthorized on backend API calls
**Solution:** Make sure you added the SUPABASE_SERVICE_ROLE_KEY to backend/.env

### Issue: Backend won't start
**Solution:** Run `pip install -r requirements.txt` in the backend directory

### Issue: CORS errors
**Solution:** Backend is configured for http://localhost:3000. If using different port, update CORS in backend/main.py line 30

---

## What This Gives You

✅ JWT-based authentication
✅ Backend validates every request
✅ Rate limiting (10 tests per minute)
✅ Proper separation of concerns
✅ Industry-standard architecture
✅ Secure data access control

---

## Backend API Endpoints

All require `Authorization: Bearer <jwt_token>` header:

- `POST /api/tests` - Save test result (rate limited)
- `GET /api/tests/history` - Get test history
- `GET /api/tests/stats` - Get statistics

## Files Changed

**Backend:**
- `backend/requirements.txt` - Added dependencies
- `backend/.env` - Added SUPABASE_SERVICE_ROLE_KEY
- `backend/middleware/__init__.py` - Created
- `backend/middleware/auth.py` - Created JWT middleware
- `backend/main.py` - Added auth endpoints

**Frontend:**
- `frontend/src/components/typing-practice.tsx` - Calls backend API
- `frontend/src/app/dashboard/page.tsx` - Fetches from backend
- `frontend/src/app/history/page.tsx` - Fetches from backend
- `frontend/src/hooks/use-auth.ts` - Fixed loading issue
