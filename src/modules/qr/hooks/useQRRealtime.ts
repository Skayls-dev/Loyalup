import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../shared/lib/supabaseClient'
import type { Profile } from '../../../shared/types'
import type { PendingTransactionPayload } from '../services/qrService'

type UseQRRealtimeResult = {
  pendingTransaction: PendingTransactionPayload | null
  clientProfile: Profile | null
  clientPoints: number
  totalVisites: number
  clearPending: () => void
}

function resolveClientName(
  rawNom: string | null | undefined,
  rawEmail: string | null | undefined,
  clientId: string,
): string {
  const nom = (rawNom ?? '').trim()

  if (nom) {
    return nom
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
    rawProfile?.email,
    payload.client_id,
  )

  return {
    id: String(rawProfile?.id ?? payload.client_id),
    email: typeof rawProfile?.email === 'string' ? rawProfile.email : '',
    role: (rawProfile?.role as Profile['role'] | undefined) ?? 'client',
    nom: resolvedName,
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
  const [totalVisites, setTotalVisites] = useState(0)

  useEffect(() => {
    if (!fournisseurId) {
      setPendingTransaction(null)
      setClientProfile(null)
      setClientPoints(0)
      setTotalVisites(0)
      return
    }

    let cancelled = false
    let pollTimer: ReturnType<typeof window.setInterval> | null = null
    const channel = supabase.channel(`merchant-pending-transactions-${fournisseurId}`)

    const clearPendingState = () => {
      if (cancelled) {
        return
      }

      setPendingTransaction(null)
      setClientProfile(null)
      setClientPoints(0)
      setTotalVisites(0)
    }

    const hydratePending = async (payload: PendingTransactionPayload) => {
      if (payload.status !== 'pending') {
        clearPendingState()
        return
      }

      if (cancelled) {
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, email, role, nom, created_at')
        .eq('id', payload.client_id)
        .maybeSingle()

      if (!cancelled) {
        setClientProfile(buildFallbackProfile(payload, (data as Partial<Profile> | null) ?? null))
      }

      const { data: pointsData } = await supabase
        .from('client_points')
        .select('solde, total_visites')
        .eq('client_id', payload.client_id)
        .eq('fournisseur_id', payload.fournisseur_id)
        .maybeSingle<{ solde: number | string | null; total_visites: number | string | null }>()

      if (!cancelled) {
        const balance = Number(pointsData?.solde ?? 0)
        const visits = Number(pointsData?.total_visites ?? 0)
        setClientPoints(Number.isFinite(balance) ? balance : 0)
        setTotalVisites(Number.isFinite(visits) ? visits : 0)
        setPendingTransaction(payload)
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
        return
      }

      clearPendingState()
    }

    void loadCurrentPending()

    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pending_transactions',
          filter: `fournisseur_id=eq.${fournisseurId}`,
        },
        (payload) => {
          void hydratePending(payload.new as PendingTransactionPayload)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pending_transactions',
          filter: `fournisseur_id=eq.${fournisseurId}`,
        },
        (payload) => {
          void hydratePending(payload.new as PendingTransactionPayload)
        },
      )
      .subscribe()

    pollTimer = window.setInterval(() => {
      void loadCurrentPending()
    }, 1000)

    return () => {
      cancelled = true
      if (pollTimer) {
        window.clearInterval(pollTimer)
      }
      void supabase.removeChannel(channel)
    }
  }, [fournisseurId])

  const clearPending = () => {
    setPendingTransaction(null)
    setClientProfile(null)
    setClientPoints(0)
    setTotalVisites(0)
  }

  return useMemo(
    () => ({ pendingTransaction, clientProfile, clientPoints, totalVisites, clearPending }),
    [pendingTransaction, clientProfile, clientPoints, totalVisites],
  )
}
