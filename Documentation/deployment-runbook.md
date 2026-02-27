# LoyalUp Deployment Runbook

## Step 15 — Supabase production setup

```bash
# Link to production project
supabase link --project-ref your-project-ref

# Push all migrations to production
supabase db push

# Deploy all Edge Functions
supabase functions deploy generate-qr
supabase functions deploy validate-qr
supabase functions deploy credit-points
supabase functions deploy unlock-reward

# Set production secrets
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=xxx
```

Run in Supabase SQL Editor to verify RLS is enabled:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

All tables should return `rowsecurity = true`.

## Step 16 — Vercel deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy to staging
vercel --env VITE_SUPABASE_URL=xxx --env VITE_SUPABASE_ANON_KEY=xxx

# Deploy to production
vercel --prod
```

Set these env vars in the Vercel dashboard:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENV`

## Final production checklist

## Local predeploy checks

macOS/Linux:

```bash
npm run predeploy
```

Windows PowerShell:

```powershell
npm run predeploy:win
```

Runtime regression smoke check (Windows):

```powershell
npm run smoke:runtime:win
```

Detailed manual steps: `Documentation/runtime-smoke-checklist.md`

### Security
- RLS enabled on ALL tables
- No sensitive data in client-side env vars
- Edge Functions use service role key server-side only
- JWT verified in every Edge Function
- QR tokens single-use + expiry enforced

### Performance
- Lighthouse score > 90 on mobile
- First contentful paint < 1.5s
- Bundle size < 500kb gzipped
- Images optimized (WebP format)
- Lazy loading on heavy components

### PWA
- Installable on iOS and Android
- Works offline for read operations
- Service worker registered
- App manifest complete
- Icons all sizes present

### Testing
- Unit test coverage > 80% on services
- All critical flows have integration tests
- No TypeScript errors
- No console errors in production build
