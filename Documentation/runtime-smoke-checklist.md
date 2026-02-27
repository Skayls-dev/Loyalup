# Runtime Smoke Checklist

Use this after runtime-sensitive changes (routing, realtime promotions, transaction history queries).

## Quick command (Windows)

```powershell
npm run smoke:runtime:win
```

## What to verify in browser

1. **Router warning**
   - Open app at `http://127.0.0.1:5173`
   - Expected: no React Router future warning in console

2. **Promotions loop warning**
   - Login as client and open promotions screen
   - Keep page open for ~30 seconds
   - Expected: no `Maximum update depth exceeded` warning

3. **Transactions 400**
   - Open loyalty history and provider recent transactions views
   - Check Network tab
   - Expected: no failed `transactions` requests with status 400

## Optional fast mode

Skip the long-running dev server start:

```powershell
npm run smoke:runtime:win:no-server
```
