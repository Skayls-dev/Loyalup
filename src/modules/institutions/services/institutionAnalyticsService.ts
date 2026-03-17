import { supabase } from '../../../shared/lib/supabaseClient'
import type {
  GeographicEntry,
  GrowthPoint,
  InstitutionOverview,
  MerchantLeaderboardEntry,
  Period,
} from '../types/institutionTypes'

export async function getInstitutionOverview(period: Period): Promise<InstitutionOverview> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getOverview',
      period,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as InstitutionOverview
}

export async function getClientGrowthTimeline(period: Period): Promise<GrowthPoint[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getClientGrowthTimeline',
      period,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as GrowthPoint[]
}

export async function getMerchantLeaderboard(period: Period): Promise<MerchantLeaderboardEntry[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getMerchantLeaderboard',
      period,
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as MerchantLeaderboardEntry[]
}

export async function getGeographicBreakdown(): Promise<GeographicEntry[]> {
  const { data, error } = await supabase.functions.invoke('institution-analytics', {
    body: {
      action: 'getGeographicBreakdown',
    },
  })

  if (error) {
    throw new Error(error.message)
  }

  return data as GeographicEntry[]
}
