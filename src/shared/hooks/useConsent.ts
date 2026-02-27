import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useAuthStore } from '../../modules/auth/store/authStore'
import { CONSENT_TYPE_LIST, CURRENT_POLICY_VERSION } from '../lib/consentPolicy'
import { supabase } from '../lib/supabaseClient'
import type { ConsentRecord, ConsentType } from '../types'

let consentResourceUnavailable = false

type UseConsentResult = {
  consents: ConsentRecord[]
  hasConsent: (type: ConsentType) => boolean
  updateConsent: (type: ConsentType, granted: boolean) => Promise<void>
  loading: boolean
  lastUpdatedAt: string | null
}

export function useConsent(): UseConsentResult {
  const { user } = useAuth()
  const authConsents = useAuthStore((state) => state.userConsents)
  const setAuthConsents = useAuthStore((state) => state.setUserConsents)
  const [loading, setLoading] = useState(false)

  const fetchConsents = useCallback(async () => {
    if (consentResourceUnavailable) {
      setAuthConsents([])
      return
    }

    if (!user?.id) {
      setAuthConsents([])
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('user_consents')
        .select('id, user_id, consent_type, granted, policy_version, granted_at, revoked_at')
        .eq('user_id', user.id)
        .order('granted_at', { ascending: false })

      if (error) {
        if (isMissingConsentResourceError(error)) {
          consentResourceUnavailable = true
          setAuthConsents([])
          return
        }

        throw error
      }

      const rows = (data ?? []) as ConsentRecord[]
      const latestByType = new Map<ConsentType, ConsentRecord>()

      for (const type of CONSENT_TYPE_LIST) {
        const row = rows.find((item) => item.consent_type === type)
        if (row) {
          latestByType.set(type, row)
        }
      }

      setAuthConsents(Array.from(latestByType.values()))
    } finally {
      setLoading(false)
    }
  }, [setAuthConsents, user?.id])

  useEffect(() => {
    fetchConsents().catch(() => {
      setAuthConsents([])
    })
  }, [fetchConsents, setAuthConsents])

  const hasConsent = useCallback(
    (type: ConsentType) => {
      if (type === 'essential') {
        return true
      }

      const found = authConsents.find((item) => item.consent_type === type)
      if (!found) {
        return false
      }

      return found.granted && !found.revoked_at
    },
    [authConsents],
  )

  const updateConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      if (consentResourceUnavailable) {
        return
      }

      if (!user?.id) {
        return
      }

      const nowIso = new Date().toISOString()

      const { data, error } = await supabase
        .from('user_consents')
        .upsert(
          {
            user_id: user.id,
            consent_type: type,
            granted,
            policy_version: CURRENT_POLICY_VERSION,
            granted_at: nowIso,
            revoked_at: granted ? null : nowIso,
            user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
          },
          { onConflict: 'user_id,consent_type,policy_version' },
        )
        .select('id, user_id, consent_type, granted, policy_version, granted_at, revoked_at')
        .single()

      if (error) {
        if (isMissingConsentResourceError(error)) {
          consentResourceUnavailable = true
          return
        }

        throw error
      }

      const next = authConsents.filter((item) => item.consent_type !== type)
      next.push(data as ConsentRecord)
      setAuthConsents(next)
    },
    [authConsents, setAuthConsents, user?.id],
  )

  const lastUpdatedAt = useMemo(() => {
    if (authConsents.length === 0) {
      return null
    }

    return authConsents
      .map((item) => item.granted_at)
      .sort((left, right) => right.localeCompare(left))[0]
  }, [authConsents])

  return {
    consents: authConsents,
    hasConsent,
    updateConsent,
    loading,
    lastUpdatedAt,
  }
}

function isMissingConsentResourceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const maybeError = error as { code?: string; message?: string; details?: string; status?: number }

  if (maybeError.status === 404 || maybeError.code === 'PGRST205') {
    return true
  }

  const message = `${maybeError.message ?? ''} ${maybeError.details ?? ''}`.toLowerCase()
  return message.includes('user_consents') && (message.includes('not found') || message.includes('does not exist'))
}
