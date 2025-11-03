
# BrightChirp Reflection Tracker (Basic)
Minimal Next.js + Supabase app for clients to log weekly reflections and track a progress score per goal.

## Quick start
1. Create Supabase project; enable Email (magic link).
2. Create `goals` and `entries` tables (see SQL in your setup doc).
3. In Vercel project settings, set env vars:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
4. Deploy → open the URL → sign in via magic link → add goals → save a reflection.

## Local dev
```bash
npm install
npm run dev
```
