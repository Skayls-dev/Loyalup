import { supabase } from '../lib/supabaseClient'

type StartProviderTrialResponse = {
  success?: boolean
  tier?: string
  tier_expires_at?: string | null
  error?: string
}

export async function startProviderTrial() {
  const accessToken = await getAccessTokenOrThrow()

  const { data, error } = await supabase.functions.invoke<StartProviderTrialResponse>('start-provider-trial', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: {
      access_token: accessToken,
    },
  })

  if (error) {
    throw new Error(await extractFunctionErrorMessage(error, 'Trial activation failed'))
  }

  if (!data?.success) {
    throw new Error(data?.error ?? 'Trial activation failed')
  }

  return data
}

async function getAccessTokenOrThrow(): Promise<string> {
  const { data, error } = await supabase.auth.getSession()
  if (error) {
    throw new Error(error.message)
  }

  const token = data.session?.access_token
  if (!token) {
    throw new Error('Session expirée, reconnectez-vous.')
  }

  return token
}

async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!error || typeof error !== 'object') {
    return fallback
  }

  const maybeContext = (error as { context?: unknown }).context

  if (maybeContext && typeof maybeContext === 'object') {
    const responseLike = maybeContext as {
      clone?: () => unknown
      json?: () => Promise<unknown>
      text?: () => Promise<string>
    }

    const readable =
      typeof responseLike.clone === 'function'
        ? (responseLike.clone() as { json?: () => Promise<unknown>; text?: () => Promise<string> })
        : responseLike

    if (typeof readable.json === 'function') {
      try {
        const payload = await readable.json()
        if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
          return payload.error
        }
      } catch {
      }
    }

    if (typeof readable.text === 'function') {
      try {
        const text = await readable.text()
        if (text) {
          return text
        }
      } catch {
      }
    }
  }

  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message
  }

  return fallback
}
