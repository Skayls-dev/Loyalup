import { supabase } from './supabaseClient'

type LogUserEventInput = {
  userId?: string | null
  eventType: string
  properties?: Record<string, unknown>
  page?: string
}

export async function logUserEvent(input: LogUserEventInput): Promise<void> {
  const sessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `session-${Math.random().toString(36).slice(2)}`

  const { error } = await supabase.from('user_events').insert({
    user_id: input.userId ?? null,
    session_id: sessionId,
    event_type: input.eventType,
    properties: input.properties ?? {},
    page: input.page ?? null,
    app_version: 'web',
  })

  if (error) {
    console.warn('[analytics] Failed to log event:', error.message)
  }
}
