import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

type TierRule = {
  tier: string
  requests_per_minute: number
  requests_per_day: number
}

type RateLimitResult = {
  limited: boolean
  retry_after: number
  limit: number
  remaining: number
  reset_at: string
  minute: {
    limit: number
    remaining: number
    reset_at: string
  }
  day: {
    limit: number
    remaining: number
    reset_at: string
  }
}

type UsageSummary = {
  minute: { used: number; limit: number; remaining: number; reset_at: string }
  day: { used: number; limit: number; remaining: number; reset_at: string }
}

function getWindowKeyMinute(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}T${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

function getWindowKeyDay(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function getMinuteReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes() + 1, 0, 0))
}

function getDayReset(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))
}

export async function checkRateLimit(adminClient: SupabaseClient, apiKeyId: string, tier: string): Promise<RateLimitResult> {
  const now = new Date()

  const { data: rule, error: ruleError } = await adminClient
    .from('rate_limit_rules')
    .select('tier, requests_per_minute, requests_per_day')
    .eq('tier', tier)
    .maybeSingle<TierRule>()

  if (ruleError || !rule) {
    throw new Error(`Rate limit rule not found for tier: ${tier}`)
  }

  const minuteReset = getMinuteReset(now)
  const dayReset = getDayReset(now)

  const minuteWindowKey = getWindowKeyMinute(now)
  const dayWindowKey = getWindowKeyDay(now)

  const minuteCount = await incrementWindow(adminClient, {
    apiKeyId,
    windowType: 'minute',
    windowKey: minuteWindowKey,
    expiresAt: minuteReset,
  })

  const dayCount = await incrementWindow(adminClient, {
    apiKeyId,
    windowType: 'day',
    windowKey: dayWindowKey,
    expiresAt: dayReset,
  })

  const minuteRemaining = Math.max(0, rule.requests_per_minute - minuteCount)
  const dayRemaining = Math.max(0, rule.requests_per_day - dayCount)

  const minuteLimited = minuteCount > rule.requests_per_minute
  const dayLimited = dayCount > rule.requests_per_day

  const limited = minuteLimited || dayLimited

  const retryAfter = minuteLimited
    ? Math.max(1, Math.ceil((minuteReset.getTime() - now.getTime()) / 1000))
    : dayLimited
      ? Math.max(1, Math.ceil((dayReset.getTime() - now.getTime()) / 1000))
      : 0

  return {
    limited,
    retry_after: retryAfter,
    limit: minuteLimited ? rule.requests_per_minute : rule.requests_per_day,
    remaining: Math.min(minuteRemaining, dayRemaining),
    reset_at: minuteLimited ? minuteReset.toISOString() : dayReset.toISOString(),
    minute: {
      limit: rule.requests_per_minute,
      remaining: minuteRemaining,
      reset_at: minuteReset.toISOString(),
    },
    day: {
      limit: rule.requests_per_day,
      remaining: dayRemaining,
      reset_at: dayReset.toISOString(),
    },
  }
}

export async function getUsageSummary(adminClient: SupabaseClient, apiKeyId: string, tier: string): Promise<UsageSummary> {
  const now = new Date()

  const { data: rule, error: ruleError } = await adminClient
    .from('rate_limit_rules')
    .select('requests_per_minute, requests_per_day')
    .eq('tier', tier)
    .single<{ requests_per_minute: number; requests_per_day: number }>()

  if (ruleError || !rule) {
    throw new Error(`Rate limit rule not found for tier: ${tier}`)
  }

  const minuteWindowKey = getWindowKeyMinute(now)
  const dayWindowKey = getWindowKeyDay(now)

  const { data: windows } = await adminClient
    .from('api_rate_windows')
    .select('window_type, window_key, usage_count')
    .eq('api_key_id', apiKeyId)
    .in('window_type', ['minute', 'day'])

  let minuteUsed = 0
  let dayUsed = 0

  for (const row of windows ?? []) {
    if (row.window_type === 'minute' && row.window_key === minuteWindowKey) {
      minuteUsed = Number(row.usage_count ?? 0)
    }

    if (row.window_type === 'day' && row.window_key === dayWindowKey) {
      dayUsed = Number(row.usage_count ?? 0)
    }
  }

  return {
    minute: {
      used: minuteUsed,
      limit: rule.requests_per_minute,
      remaining: Math.max(0, rule.requests_per_minute - minuteUsed),
      reset_at: getMinuteReset(now).toISOString(),
    },
    day: {
      used: dayUsed,
      limit: rule.requests_per_day,
      remaining: Math.max(0, rule.requests_per_day - dayUsed),
      reset_at: getDayReset(now).toISOString(),
    },
  }
}

async function incrementWindow(
  adminClient: SupabaseClient,
  params: {
    apiKeyId: string
    windowType: 'minute' | 'day'
    windowKey: string
    expiresAt: Date
  },
): Promise<number> {
  const { apiKeyId, windowType, windowKey, expiresAt } = params

  const { data: existing, error: readError } = await adminClient
    .from('api_rate_windows')
    .select('id, usage_count')
    .eq('api_key_id', apiKeyId)
    .eq('window_type', windowType)
    .eq('window_key', windowKey)
    .maybeSingle<{ id: string; usage_count: number }>()

  if (readError) {
    throw readError
  }

  if (!existing?.id) {
    const { data: inserted, error: insertError } = await adminClient
      .from('api_rate_windows')
      .insert({
        api_key_id: apiKeyId,
        window_type: windowType,
        window_key: windowKey,
        usage_count: 1,
        expires_at: expiresAt.toISOString(),
      })
      .select('usage_count')
      .single<{ usage_count: number }>()

    if (insertError) {
      throw insertError
    }

    return Number(inserted?.usage_count ?? 1)
  }

  const nextCount = Number(existing.usage_count ?? 0) + 1

  const { data: updated, error: updateError } = await adminClient
    .from('api_rate_windows')
    .update({ usage_count: nextCount, expires_at: expiresAt.toISOString() })
    .eq('id', existing.id)
    .select('usage_count')
    .single<{ usage_count: number }>()

  if (updateError) {
    throw updateError
  }

  return Number(updated?.usage_count ?? nextCount)
}

export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.minute.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.minute.remaining)),
    'X-RateLimit-Reset': result.minute.reset_at,
    'Retry-After': String(result.retry_after),
  }
}

export function getAdminClientFromEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, serviceRoleKey)
}
