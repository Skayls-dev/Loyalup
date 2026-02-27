# 🔗 Data Flow Architecture - Week 10 Gamification

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              UI Components (React/TypeScript)                │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  • LevelBadge        • ChallengeCard      • ReferralView    │  │
│  │  • XPProgressBar     • ChallengeList      • Marketplace     │  │
│  │  • LevelUpModal      • StreakDisplay      • Leaderboard     │  │
│  │  • BadgeCard         • BadgeGallery       • ProviderNetwork │  │
│  │                                           • AdminDashboard  │  │
│  │                                                              │  │
│  └──────────→ ┌────────────────────────────┐ ←─────────────────┘  │
│              │   React Hooks (State Mgmt)  │                       │
│              ├────────────────────────────┤                       │
│              │                            │                       │
│              │ • useClientLevel()         │                       │
│              │ • useBadges()              │                       │
│              │ • useChallenges()          │                       │
│              │ • useStreak()              │                       │
│              │ • useLeaderboard()         │                       │
│              │ • useReferral()            │                       │
│              │ • useMarketplace()         │                       │
│              │                            │                       │
│              └────────→ ┌──────────────────────────────┐ ←────────┘
│                        │  Service Layer (TypeScript)  │
│                        ├──────────────────────────────┤
│                        │                              │
│                        │ gamificationService          │
│                        │ • getClientLevel()           │
│                        │ • getClientBadges()          │
│                        │ • getActiveChallenges()      │
│                        │ • getClientStreak()          │
│                        │ • getLeaderboard()           │
│                        │ • generateReferralLink()     │
│                        │ • transferPoints()           │
│                        │                              │
│                        │ networkService               │
│                        │ • getProviderCoalitions()    │
│                        │ • getCoalitionMembers()      │
│                        │ • getNetworkStats()          │
│                        │ • getViralMetrics()          │
│                        │ • getReferralFunnel()        │
│                        │ • getTopReferrers()          │
│                        │                              │
│                        └────────→ SUPABASE CLIENT ←────────┘
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │              Edge Functions (Deno/TypeScript)              │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │   │
│  │  │  award-xp    │  │ check-badges │  │ update-streak│    │   │
│  │  │              │  │              │  │              │    │   │
│  │  │ INPUT:       │  │ INPUT:       │  │ INPUT:       │    │   │
│  │  │ • xp_amount  │  │ • trigger_   │  │ • visit_date │    │   │
│  │  │ • source     │  │   type       │  │ • fournisseur│    │   │
│  │  │              │  │              │  │   _id        │    │   │
│  │  │ OUTPUT:      │  │ OUTPUT:      │  │              │    │   │
│  │  │ • leveled_up │  │ • badges_    │  │ OUTPUT:      │    │   │
│  │  │ • new_level  │  │   awarded    │  │ • streak     │    │   │
│  │  │ • perks      │  │              │  │   (±)        │    │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘    │   │
│  │                                                            │   │
│  │  ┌──────────────────┐  ┌──────────────────┐              │   │
│  │  │update-challenges │  │ transfer-points  │              │   │
│  │  │                  │  │                  │              │   │
│  │  │INPUT:            │  │INPUT:            │              │   │
│  │  │• event_type      │  │• from_provider_id│              │   │
│  │  │• value           │  │• to_provider_id  │              │   │
│  │  │                  │  │• amount          │              │   │
│  │  │OUTPUT:           │  │                  │              │   │
│  │  │• challenges_     │  │OUTPUT:           │              │   │
│  │  │  updated         │  │• points_deducted│              │   │
│  │  │• rewards_point   │  │• points_credited│              │   │
│  │  └──────────────────┘  └──────────────────┘              │   │
│  │                                                            │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐           │   │
│  │  │generate-referral │  │activate-referral     │           │   │
│  │  │                  │  │                      │           │   │
│  │  │INPUT: (optional) │  │INPUT:                │           │   │
│  │  │• fournisseur_id  │  │• referral_code       │           │   │
│  │  │                  │  │                      │           │   │
│  │  │OUTPUT:           │  │OUTPUT:               │           │   │
│  │  │• referral_code   │  │• activated           │           │   │
│  │  │• share_url       │  │• referrer_id         │           │   │
│  │  └──────────────────┘  └──────────────────────┘           │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │            PostgreSQL Database (RLS Secured)               │   │
│  ├────────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  GAMIFICATION TABLES:                                      │   │
│  │  ├─ client_levels          (current level + XP)           │   │
│  │  ├─ xp_transactions        (earning audit log)            │   │
│  │  ├─ badge_definitions      (24 badge types, i18n)         │   │
│  │  ├─ client_badges          (earned badges per client)     │   │
│  │  ├─ level_definitions      (10 levels with perks)         │   │
│  │  ├─ challenges             (active challenges)            │   │
│  │  ├─ client_challenge_progress (completion tracking)       │   │
│  │  ├─ client_streaks         (streak counters)              │   │
│  │  ├─ leaderboard_entries    (pre-computed rankings)        │   │
│  │  │                                                         │   │
│  │  MARKETPLACE TABLES:                                       │   │
│  │  ├─ provider_coalitions    (coalition configs)            │   │
│  │  ├─ coalition_members      (provider membership)          │   │
│  │  ├─ point_transfers        (atomic transfer log)          │   │
│  │  │                                                         │   │
│  │  REFERRAL TABLES:                                          │   │
│  │  ├─ client_referrals       (referral tracking)            │   │
│  │  └─ provider_referrals     (provider referral codes)      │   │
│  │                                                            │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow: User Scans Payment (End-to-end)

```
1. CLIENT SCANS QR CODE
   ↓
2. triggerScanEvent(clientId, providerId, amount)
   ↓ (Browser JavaScript)
3. EDGE FUNCTION CHAIN:
   
   a) award-xp(+10 from scan, +1 per euro)
      ├─ INSERT xp_transactions
      ├─ UPDATE client_levels
      └─ IF leveled_up:
         └─ Trigger LevelUpModal
   
   b) check-badges(trigger='transaction_count')
      ├─ Fetch badge_definitions
      ├─ Check client stats
      ├─ FOREACH qualified badge:
      │  ├─ INSERT client_badges
      │  ├─ award-xp recursively (+50-500)
      │  └─ Notify user
      └─ Return { badges_awarded }
   
   c) update-streak(visit_date=today)
      ├─ Fetch client_streaks
      ├─ Compare last_visit_date
      ├─ IF yesterday: increment streak
      ├─ IF today: no-op
      ├─ IF earlier: reset streak
      ├─ Check milestone badges (7/30/100)
      ├─ award-xp (+100/300/1000)
      └─ Return { current_streak, longest_streak }
   
   d) update-challenges(event='scan', value=1)
      ├─ Fetch active challenges
      ├─ UPSERT client_challenge_progress
      ├─ IF newly_completed:
      │  ├─ Award points (raw UPDATE)
      │  ├─ award-xp recursively
      │  ├─ Check badges
      │  └─ Notify user
      └─ Return { challenges_updated }

4. SERVICE LAYER AGGREGATES:
   ├─ getClientLevel() → Current XP bar
   ├─ getClientBadges() → Earned badges list
   ├─ getClientStreak() → Streak counter
   └─ getActiveChallenges() → Updated progress

5. HOOKS UPDATE REACT STATE:
   ├─ useClientLevel.refetch()
   ├─ useBadges.refetch()
   ├─ useStreak.refetch()
   └─ useChallenges.refetch()

6. COMPONENTS RE-RENDER:
   ├─ LevelBadge (animate if leveled_up)
   ├─ XPProgressBar (update progress)
   ├─ BadgeGallery (show new badges)
   ├─ StreakDisplay (update counter)
   └─ ChallengeList (update progress bars)
```

## Data Flow: Referral Complete Purchase

```
1. NEW USER SIGNS UP WITH REFERRAL CODE
   ↓
2. AUTOMATIC: activate-referral(referral_code)
   ├─ Find referral by code
   ├─ Validate (not-expired, not-used, not-self)
   ├─ UPDATE client_referrals (status='activated')
   └─ Return { referrer_id, message }

3. NEW USER MAKES FIRST PURCHASE (FUTURE)
   ├─ Trigger event on credit
   └─ Award referrer:
      ├─ award-xp(+200 'referral_complete')
      ├─ check-badges(trigger='referral_count')
      └─ Notify referrer with badge

4. LEADERBOARD UPDATES (NIGHTLY CRON):
   └─ Recompute leaderboard_entries ranks
```

## Data Flow: Marketplace Transfer

```
1. USER INITIATES TRANSFER
   ├─ Select from_provider: "Starbucks"
   ├─ Select to_provider: "Decathlon"
   ├─ Enter amount: 100 points
   └─ Click "Transfer"

2. EDGE FUNCTION: transfer-points(...)
   ├─ Validate both providers in same coalition
   ├─ Fetch coalition (conversion_rate, platform_fee_pct)
   ├─ Check source balance ≥ 100
   │
   ├─ BEGIN TRANSACTION:
   │  │
   │  ├─ DECREMENT source (-100)
   │  ├─ Calculate fee (10% = 10)
   │  ├─ Calculate credits (90 × conversion_rate)
   │  ├─ INCREMENT destination (+credits)
   │  ├─ INSERT point_transfers (audit log)
   │  │
   │  └─ ON ERROR: ROLLBACK both updates
   │
   ├─ award-xp(+20 'transfer')
   ├─ check-badges(trigger='transfer_count')
   ├─ update-challenges(event='transfer')
   └─ Notify user with breakdown

3. SERVICE UPDATES:
   └─ getTransferOptions() refreshes balances

4. UI UPDATES:
   └─ MarketplaceView shows success
```

## Data Flow: Admin Analytics Fetch

```
1. ADMIN OPENS DASHBOARD
   ↓
2. PARALLEL FETCH (browser):
   ├─ getNetworkStats()
   │  └─ SELECT SUM(xp_amount) FROM xp_transactions
   │  └─ SELECT COUNT() FROM client_badges
   │  └─ SELECT SUM(points_deducted) FROM point_transfers
   │  └─ SELECT COUNT() FROM client_referrals...
   │
   ├─ getViralMetrics()
   │  └─ GROUP BY referrer_id
   │  └─ COUNT distinct referred clients
   │
   ├─ getReferralFunnel()
   │  └─ 3-stage funnel: generated → activated → rewarded
   │
   ├─ getTopReferrers()
   │  └─ ORDER BY referral_count DESC LIMIT 10
   │
   └─ getCoalitionLeaderboard()
      └─ ORDER BY points_transferred DESC

3. COMPONENTS RENDER:
   ├─ StatsCard (display KPIs)
   ├─ ReferralFunnelChart (visualize funnel)
   ├─ ViralMetricsChart (2-tier growth)
   ├─ TopReferrersList (leaderboard)
   ├─ CoalitionLeaderboard (ranking)
   └─ 3× Insights (automated recommendations)
```

## Authorization Layer (RLS)

```
POLICIES BY TABLE:

client_levels:
  • Public: SELECT (public leaderboard)
  • Client: SELECT own only
  • Client: UPSERT own only

badge_definitions:
  • Public: SELECT where is_secret=false
  • Public: SELECT where is_active=true

client_badges:
  • Client: SELECT own only
  • Client: INSERT own only (system)

challenges:
  • Public: SELECT where is_active=true

client_referrals:
  • Client: SELECT own only
  • Client: INSERT own only
  • Client: UPDATE own status

point_transfers:
  • Client: SELECT own only
  • System: INSERT (via function)

coalition_members:
  • Provider: SELECT own coalition
  • Admin: SELECT all

leaderboard_entries:
  • Public: SELECT (anonymized names)
```

## Error Handling Strategy

```
EDGE FUNCTIONS:
├─ Input validation (early exit)
├─ Database constraints (PostgreSQL)
├─ Try-catch wrapper (graceful failure)
├─ Partial success handling
│  ├─ Continue on notification failure
│  ├─ Continue on badge check failure
│  └─ Never partial on transfers (atomic)
└─ Detailed error logging

REACT HOOKS:
├─ Error state capture
├─ Network retry logic
├─ Fallback loading states
└─ User-friendly error messages

COMPONENTS:
├─ Error boundaries
├─ Loading skeletons
├─ Empty state handling
└─ Timeout management
```

## Performance Optimizations

```
DATABASE:
├─ Indexes on foreign keys
├─ Indexes on frequently queried fields
├─ Denormalized leaderboard table
└─ Partitioned point_transfers (by month)

EDGE FUNCTIONS:
├─ Minimal sequential queries
├─ Parallel batch processing
├─ Connection pooling
└─ Cached coalition configs (TTL: 5min)

CLIENT:
├─ Lazy loading of collections
├─ Pagination on leaderboards
├─ Debounced transfer preview
├─ Cached service responses (SWR)
└─ Minimal re-renders (React.memo)
```

---

**This architecture ensures:**
- ✅ Data consistency (atomic transactions)
- ✅ Security (RLS + JWT validation)
- ✅ Performance (optimized queries)
- ✅ Reliability (error recovery)
- ✅ Scalability (serverless + database)
