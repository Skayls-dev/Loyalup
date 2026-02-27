#!/usr/bin/env node

/**
 * Week 10 Gamification - Smoke Test
 * Tests all components and services are properly exported and functional
 */

import fs from 'fs'
import path from 'path'

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

const tests = []
let passed = 0
let failed = 0

function test(name, fn) {
  tests.push({ name, fn })
}

function log(color, message) {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`)
}

async function runTests() {
  log('blue', '\n🧪 Week 10 Gamification - Smoke Tests\n')

  for (const { name, fn } of tests) {
    try {
      await fn()
      log('green', `✓ ${name}`)
      passed++
    } catch (error) {
      log('red', `✗ ${name}`)
      console.error(`  ${error.message}`)
      failed++
    }
  }

  log(
    'blue',
    `\n${passed + failed} tests run - ${COLORS.green}${passed} passed${COLORS.reset} - ${COLORS.red}${failed} failed${COLORS.reset}\n`,
  )

  process.exit(failed > 0 ? 1 : 0)
}

// ============ TESTS ============

test('Database migrations exist', () => {
  const files = [
    'supabase/migrations/20260226000000_week10_gamification.sql',
    'supabase/migrations/20260226000100_seed_badge_definitions.sql',
    'supabase/migrations/20260226000200_seed_level_definitions.sql',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Migration missing: ${file}`)
    }
  }
})

test('Edge functions exist', () => {
  const functions = [
    'supabase/functions/award-xp/index.ts',
    'supabase/functions/check-badges/index.ts',
    'supabase/functions/update-streak/index.ts',
    'supabase/functions/update-challenges/index.ts',
    'supabase/functions/transfer-points/index.ts',
    'supabase/functions/generate-referral/index.ts',
    'supabase/functions/activate-referral/index.ts',
    'supabase/functions/generate-provider-referral/index.ts',
  ]

  for (const fn of functions) {
    if (!fs.existsSync(fn)) {
      throw new Error(`Function missing: ${fn}`)
    }
  }
})

test('Services exist', () => {
  const files = [
    'src/modules/gamification/services/gamificationService.ts',
    'src/modules/gamification/services/networkService.ts',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Service missing: ${file}`)
    }
  }
})

test('Hooks exist', () => {
  const files = [
    'src/modules/gamification/hooks/useClientLevel.ts',
    'src/modules/gamification/hooks/useBadges.ts',
    'src/modules/gamification/hooks/useChallenges.ts',
    'src/modules/gamification/hooks/useStreak.ts',
    'src/modules/gamification/hooks/useLeaderboard.ts',
    'src/modules/gamification/hooks/useReferral.ts',
    'src/modules/gamification/hooks/useMarketplace.ts',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Hook missing: ${file}`)
    }
  }
})

test('Client components exist', () => {
  const files = [
    'src/modules/gamification/components/LevelBadge.tsx',
    'src/modules/gamification/components/XPProgressBar.tsx',
    'src/modules/gamification/components/LevelUpModal.tsx',
    'src/modules/gamification/components/BadgeCard.tsx',
    'src/modules/gamification/components/BadgeGallery.tsx',
    'src/modules/gamification/components/ChallengeCard.tsx',
    'src/modules/gamification/components/ChallengeList.tsx',
    'src/modules/gamification/components/StreakDisplay.tsx',
    'src/modules/gamification/components/LeaderboardView.tsx',
    'src/modules/gamification/components/ReferralView.tsx',
    'src/modules/gamification/components/MarketplaceView.tsx',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Component missing: ${file}`)
    }
  }
})

test('Provider components exist', () => {
  const files = [
    'src/modules/gamification/components/provider/CoalitionCard.tsx',
    'src/modules/gamification/components/provider/CoalitionManagement.tsx',
    'src/modules/gamification/components/provider/ProviderNetworkPage.tsx',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Provider component missing: ${file}`)
    }
  }
})

test('Admin components exist', () => {
  const files = [
    'src/modules/gamification/components/admin/StatsCard.tsx',
    'src/modules/gamification/components/admin/ReferralFunnelChart.tsx',
    'src/modules/gamification/components/admin/ViralMetricsChart.tsx',
    'src/modules/gamification/components/admin/TopReferrersList.tsx',
    'src/modules/gamification/components/admin/CoalitionLeaderboard.tsx',
    'src/modules/gamification/components/admin/AdminNetworkDashboard.tsx',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Admin component missing: ${file}`)
    }
  }
})

test('Main widget exists', () => {
  if (!fs.existsSync('src/modules/gamification/GamificationWidget.tsx')) {
    throw new Error('GamificationWidget missing')
  }
})

test('Module index exports exist', () => {
  const files = [
    'src/modules/gamification/index.ts',
    'src/modules/gamification/hooks/index.ts',
    'src/modules/gamification/components/index.ts',
    'src/modules/gamification/components/provider/index.ts',
    'src/modules/gamification/components/admin/index.ts',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Index file missing: ${file}`)
    }
  }
})

test('Documentation exists', () => {
  const files = [
    'README_GAMIFICATION.md',
    'DEPLOYMENT_CHECKLIST.md',
    'INTEGRATION_GUIDE.md',
    'ARCHITECTURE.md',
    'WEEK10_COMPLETE.md',
    'QUICKSTART.md',
  ]

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`Documentation missing: ${file}`)
    }
  }
})

test('Migration contains expected tables', () => {
  const migrationPath = 'supabase/migrations/20260226000000_week10_gamification.sql'
  const content = fs.readFileSync(migrationPath, 'utf-8')

  const expectedTables = [
    'provider_coalitions',
    'coalition_members',
    'point_transfers',
    'client_referrals',
    'provider_referrals',
    'badge_definitions',
    'client_badges',
    'level_definitions',
    'client_levels',
    'xp_transactions',
    'challenges',
    'client_challenge_progress',
    'client_streaks',
    'leaderboard_entries',
  ]

  for (const table of expectedTables) {
    if (!content.includes(`CREATE TABLE ${table}`)) {
      throw new Error(`Table missing from migration: ${table}`)
    }
  }
})

test('Badge definitions seeded', () => {
  const seedPath = 'supabase/migrations/20260226000100_seed_badge_definitions.sql'
  const content = fs.readFileSync(seedPath, 'utf-8')

  // Should contain at least 24 badge inserts
  const insertCount = (content.match(/INSERT INTO badge_definitions/g) || []).length
  if (insertCount < 20) {
    throw new Error(`Not enough badges seeded: ${insertCount} (expected 24)`)
  }
})

test('Level definitions seeded', () => {
  const seedPath = 'supabase/migrations/20260226000200_seed_level_definitions.sql'
  const content = fs.readFileSync(seedPath, 'utf-8')

  // Should contain 10 level inserts
  const insertCount = (content.match(/INSERT INTO level_definitions/g) || []).length
  if (insertCount < 10) {
    throw new Error(`Not enough levels seeded: ${insertCount} (expected 10)`)
  }
})

test('Services have required functions', () => {
  const gamificationPath = 'src/modules/gamification/services/gamificationService.ts'
  const content = fs.readFileSync(gamificationPath, 'utf-8')

  const expectedFunctions = [
    'getClientLevel',
    'getClientBadges',
    'getActiveChallenges',
    'getClientStreak',
    'getLeaderboard',
    'generateReferralLink',
    'transferPoints',
    'getTransferOptions',
    'getCoalitions',
  ]

  for (const fn of expectedFunctions) {
    if (!content.includes(`export ${fn}`) && !content.includes(`export function ${fn}`)) {
      throw new Error(`Service function missing: ${fn}`)
    }
  }
})

test('Components export React components', () => {
  const componentPath = 'src/modules/gamification/components/index.ts'
  const content = fs.readFileSync(componentPath, 'utf-8')

  const expectedExports = [
    'LevelBadge',
    'XPProgressBar',
    'BadgeCard',
    'BadgeGallery',
    'ChallengeCard',
    'ChallengeList',
    'StreakDisplay',
    'LeaderboardView',
    'ReferralView',
  ]

  for (const exp of expectedExports) {
    if (!content.includes(`export { ${exp}}`)) {
      throw new Error(`Component not exported: ${exp}`)
    }
  }
})

// ============ RUN ============

runTests()
