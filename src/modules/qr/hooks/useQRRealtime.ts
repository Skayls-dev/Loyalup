import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../shared/lib/supabaseClient'
import type { Profile } from '../../../shared/types'
import {
  subscribeToPendingTransactions,
  type PendingTransactionPayload,
  unsubscribe,
} from '../services/qrService'

type UseQRRealtimeResult = {
  pendingTransaction: PendingTransactionPayload | null
  clientProfile: Profile | null
  clientPoints: number
  clearPending: () => void
}

function resolveClientName(
  rawNom: string | null | undefined,
  rawPrenom: string | null | undefined,
  rawEmail: string | null | undefined,
  clientId: string,
): string {
  const nom = (rawNom ?? '').trim()
  const prenom = (rawPrenom ?? '').trim()

  const fullName = [prenom, nom].filter(Boolean).join(' ').trim()
  if (fullName) {
    return fullName
  }

  if (nom) {
    return nom
  }

  if (prenom) {
    return prenom
  }

  const emailPrefix = (rawEmail ?? '').split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return `Client ${clientId.slice(0, 6)}`
}

function buildFallbackProfile(payload: PendingTransactionPayload, rawProfile?: Partial<Profile> | null): Profile {
  const resolvedName = resolveClientName(
    rawProfile?.nom,
    rawProfile?.prenom,
    rawProfile?.email,
    payload.client_id,
  )

  return {
    id: String(rawProfile?.id ?? payload.client_id),
    email: typeof rawProfile?.email === 'string' ? rawProfile.email : '',
    role: (rawProfile?.role as Profile['role'] | undefined) ?? 'client',
    nom: resolvedName,
    prenom: typeof rawProfile?.prenom === 'string' ? rawProfile.prenom : null,
    created_at:
      typeof rawProfile?.created_at === 'string' && rawProfile.created_at
        ? rawProfile.created_at
        : payload.created_at,
  }
}

export function useQRRealtime(fournisseurId: string | null): UseQRRealtimeResult {
  const [pendingTransaction, setPendingTransaction] =
    useState<PendingTransactionPayload | null>(null)
  const [clientProfile, setClientProfile] = useState<Profile | null>(null)
  const [clientPoints, setClientPoints] = useState(0)

  useEffect(() => {
    if (!fournisseurId) {
      return
    }

    let cancelled = false

    const hydratePending = async (payload: PendingTransactionPayload) => {
      if (payload.status !== 'pending') {
        return
      }

      if (cancelled) {
        return
      }

      setPendingTransaction(payload)

      const { data } = await supabase
        .from('profiles')
        .select('id, email, role, nom, prenom, created_at')
        .eq('id', payload.client_id)
        .maybeSingle()

      if (!cancelled) {
        setClientProfile(buildFallbackProfile(payload, (data as Partial<Profile> | null) ?? null))
      }

      const { count } = await supabase
        .from('pending_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', payload.client_id)
        .eq('fournisseur_id', payload.fournisseur_id)
        .eq('status', 'validated')

      if (!cancelled) {
        setClientPoints(count ?? 0)
      }
    }

    const loadCurrentPending = async () => {
      if (cancelled) {
        return
      }

      const { data } = await supabase
        .from('pending_transactions')
        .select('id, qr_token_id, client_id, fournisseur_id, status, created_at, expires_at')
        .eq('fournisseur_id', fournisseurId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle<PendingTransactionPayload>()

      if (data) {
        await hydratePending(data)
      }
    }

    void loadCurrentPending()
    const pollingInterval = window.setInterval(() => {
      if (!pendingTransaction) {
        void loadCurrentPending()
      }
    }, 1000)
    subscribeToPendingTransactions(fournisseurId, hydratePending)

    return () => {
      cancelled = true
      window.clearInterval(pollingInterval)
      unsubscribe()
    }
  }, [fournisseurId, pendingTransaction])

  const clearPending = () => {
    setPendingTransaction(null)
    setClientProfile(null)
    setClientPoints(0)
  }

  return useMemo(
    () => ({ pendingTransaction, clientProfile, clientPoints, clearPending }),
    [pendingTransaction, clientProfile, clientPoints],
  )
}
