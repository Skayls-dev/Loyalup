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
        .select('id, email, role, nom, created_at')
        .eq('id', payload.client_id)
        .maybeSingle()

      if (!cancelled && data) {
        setClientProfile(data)
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
    subscribeToPendingTransactions(fournisseurId, hydratePending)

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [fournisseurId])

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
