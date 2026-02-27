# 🚀 Week 10 Gamification Deployment Checklist

## Phase 1: Backend Setup (15 min)

### Database
- [ ] Run: `supabase db push` (deploys migrations)
- [ ] Verify tables created: `client_levels`, `badge_definitions`, `client_badges`, etc.
- [ ] Check seed data: Badge definitions (24 rows), Level definitions (10 rows)
- [ ] Verify RLS policies are active

### Edge Functions
- [ ] Deploy: `supabase functions deploy`
- [ ] Test award-xp function
- [ ] Test check-badges function
- [ ] Test update-streak function
- [ ] Test update-challenges function
- [ ] Test transfer-points function
- [ ] Test generate-referral function
- [ ] Test activate-referral function
- [ ] Verify all functions return expected responses

## Phase 2: Frontend Setup (10 min)

### Install Dependencies
- [ ] `npm install react-confetti`
- [ ] Verify Tailwind CSS is configured
- [ ] Check Zustand store exists for authStore

### Environmental Variables
- [ ] Confirm `VITE_SUPABASE_URL` is set
- [ ] Confirm `VITE_SUPABASE_ANON_KEY` is set

## Phase 3: Integration (20 min)

### Option A: Quick Integration (Add to existing home)
```tsx
// In src/pages/ClientHome.tsx or equivalent
import { GamificationWidget } from '@/modules/gamification'

export function ClientHome() {
  return (
    <>
      {/* Existing content */}
      <section className="mt-8">
        <GamificationWidget layout="compact" language="fr" />
      </section>
    </>
  )
}
```

### Option B: Full Integration (Separate page)
```tsx
// Create src/pages/ClientGamification.tsx
import { GamificationWidget } from '@/modules/gamification'

export default function ClientGamification() {
  return (
    <div className="p-4 space-y-4">
      <GamificationWidget layout="full" language="fr" />
    </div>
  )
}

// Add route
// In your router config:
// { path: '/gamification', component: ClientGamification }
```

### Update Navigation
- [ ] Add "🎮 Gamification" or "🏆 Défis" to bottom navigation (if using full widget)
- [ ] Route should link to `/gamification`

## Phase 4: Testing (20 min)

### Functional Tests
- [ ] **Levels**: Manually test XP increment, level-up detection
  ```bash
  # Call award-xp Edge Function with test data
  curl -X POST http://localhost:54321/functions/v1/award-xp \
    -H "Authorization: Bearer YOUR_JWT" \
    -H "Content-Type: application/json" \
    -d '{"client_id":"TEST_ID","xp_amount":500,"source":"test"}'
  ```

- [ ] **Badges**: Check badges display & unlock on XP threshold
  - Earn 100+ XP → should trigger first_scan badge

- [ ] **Challenges**: Verify challenge list loads & progress increments
  - Manually INSERT test challenge
  - Call update-challenges function
  - Verify progress updates

- [ ] **Streaks**: Test streak increment & loss detection
  - Call update-streak with visit_date
  - Check current_streak increments

- [ ] **Transfers**: Test point transfer between providers
  - Requires coalition setup in DB first
  - Test atomic rollback on insufficient balance

- [ ] **Referrals**: Test code generation & activation
  - Generate referral link
  - Activate with referred_id

### UI Tests
- [ ] LevelBadge displays correct emoji & color
- [ ] XPProgressBar shows correct percentage
- [ ] BadgeGallery loads earned + locked badges
- [ ] ChallengeList shows active challenges with timer
- [ ] StreakDisplay shows streak at-risk warning
- [ ] LeaderboardView displays top 50 + current user position
- [ ] ReferralView allows sharing & copying code
- [ ] MarketplaceView calculates fees & transfer correctly

### Responsive Tests
- [ ] Compact mode works on mobile (375px+)
- [ ] Full mode works on tablet/desktop
- [ ] All tabs scrollable on narrow screens
- [ ] Modal closes automatically after 4 seconds

## Phase 5: Polish (10 min)

### Animations
- [ ] Level-up confetti appears and falls
- [ ] Progress bars animate smoothly
- [ ] Badges shimmer effect on legendary rarity
- [ ] Streak flame animation (if implemented)

### I18n
- [ ] Test French (default): All text displays in French
- [ ] Switch to English: `<GamificationWidget language="en" />`
- [ ] Verify badge names translate correctly

### Error Handling
- [ ] Network error shows "Erreur lors du chargement"
- [ ] Refetch button reattempts failed requests
- [ ] Empty states handled (no badges, no challenges)

## Phase 6: Monitoring (5 min)

### Supabase Console
- [ ] Check Edge Function logs for errors
- [ ] Verify database queries in Realtime
- [ ] Monitor RLS policy violations

### Browser Console
- [ ] No TypeScript errors
- [ ] No Tailwind warnings
- [ ] No Supabase auth errors

## Phase 7: Documentation (5 min)

- [ ] Update user-facing help docs about gamification
- [ ] Document badge categories & how to unlock
- [ ] Document challenge types & rewards
- [ ] Document point transfer mechanics

## 🎯 Success Criteria

### Before Launch
- [ ] All 4 phases (Backend, Frontend, Integration, Testing) 100% complete
- [ ] No critical errors in browser console
- [ ] All Supabase functions return expected responses
- [ ] Database reflects correct data (badges, levels, challenges)

### After Launch
- [ ] Users can see their level & XP bar
- [ ] Users can view locked/unlocked badges
- [ ] Users can see active challenges with timers
- [ ] Users can generate referral codes
- [ ] Users can view leaderboards
- [ ] Users can transfer points between providers (if coalitions exist)

## 📝 Commands Reference

```bash
# Start development
npm run dev

# Deploy migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy

# View Supabase logs
supabase functions list
supabase functions logs award-xp

# Test Edge Function locally
curl -X POST http://localhost:54321/functions/v1/award-xp \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"client_id":"your-uuid","xp_amount":100,"source":"scan"}'
```

## 🆘 Troubleshooting

### Issue: "Module not found: gamificationService"
**Solution**: Check module path in imports. Should be `@/modules/gamification`

### Issue: "react-confetti not found"
**Solution**: Run `npm install react-confetti`

### Issue: Level data returns null
**Solution**: 
- Verify `client_levels` table has entry for user
- Check RLS policy allows SELECT

### Issue: Badges not showing
**Solution**:
- Verify `badge_definitions` table has seed data (24 rows)
- Check `client_badges` has entries
- Run check-badges function manually

### Issue: Challenges not loading
**Solution**:
- Verify `challenges` table has active entries
- Check `starts_at` and `ends_at` are current
- Verify user has `client_challenge_progress` entries

### Issue: Transfer fails "PGRST***" error
**Solution**:
- Verify source provider has sufficient points
- Verify both providers in same coalition
- Check RLS policies on `point_transfers` table

## 📊 Performance Notes

- Hooks refetch on mount only (add Realtime for live updates)
- Service layer caches nothing (add caching layer if needed)
- All queries use lean selects (no N+1 queries)
- Transfer operations are atomic (no data corruption)

## ✨ Future Enhancements

- [ ] Realtime updates via Supabase Realtime subscriptions
- [ ] Badge unlock notifications (Toast system)
- [ ] Level-up celebration (confetti + sound)
- [ ] Daily challenge resets (Cron job)
- [ ] Leaderboard recomputation (weekly job)
- [ ] Referral final-stage rewards (Event trigger)
- [ ] Provider coalition management UI
- [ ] Admin network analytics dashboard
- [ ] Push notifications for streak at-risk
- [ ] Achievement badges with unlock stories

---

**Estimated Total Time**: ~90 minutes for full deployment + testing

**Risk Level**: Low (migrations are reversible, functions are stateless, UI is isolated)

**Rollback Plan**: `supabase db reset` (regenerates from migrations) + redeploy after fix
