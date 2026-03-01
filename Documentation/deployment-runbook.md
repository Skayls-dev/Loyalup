# LoyalUp Deployment Runbook

→ Project URL      : https://your-project-ref.supabase.co
→ anon public key  : your-anon-public-key
→ service_role key : set in Supabase secrets only (do not commit)

-> VOTRE_PROJECT_REF: your-project-ref



## Step 15 — Supabase production setup

Windows PowerShell (scripté):

```powershell
# Dry-run (par défaut)
.\scripts\push-prod-migrations.ps1 -DbPassword "<DB_PASSWORD>"

# Exécution réelle
.\scripts\push-prod-migrations.ps1 -DbPassword "<DB_PASSWORD>" -Apply
```

Via npm (Windows):

```powershell
# Définir le mot de passe DB pour la session
$env:SUPABASE_DB_PASSWORD="<DB_PASSWORD>"

# Dry-run
npm run db:push:prod:win:dry-run

# Exécution réelle
npm run db:push:prod:win:apply
```

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

### Troubleshooting — Edge Functions deploy

If deployment fails with `Access token not provided` or HTTP `403`:

```powershell
npx supabase logout
npx supabase login
npx supabase projects list
```

Ensure the logged-in account can access project `yyftqivizzgvveeczbpv`.

If deployment fails with `Relative import path "@supabase/supabase-js" not prefixed...`:

- Replace imports in Edge Functions from:
	- `import { createClient } from '@supabase/supabase-js'`
- To:
	- `import { createClient } from 'npm:@supabase/supabase-js@2'`

Then redeploy all functions:

```powershell
npx supabase functions deploy --project-ref yyftqivizzgvveeczbpv --prune

# Safer (no prune)
npm run functions:deploy:prod:safe

# Or via npm script
npm run functions:deploy:prod
```

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
