import { supabase } from '../lib/supabaseClient'

type StartProviderTrialResponse = {
  success?: boolean
  tier?: string
  tier_expires_at?: string | null
  error?: string
}

export async function startProviderTrial() {
  const { data, error } = await supabase.functions.invoke<StartProviderTrialResponse>('start-provider-trial', {
    method: 'POST',
    body: {},
  })

  if (error) {
    throw error
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Trial activation failed')
  }

  return data
}
