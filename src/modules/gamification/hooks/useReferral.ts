import { useEffect, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import {
  generateReferralLink,
  getReferralStats,
  getTransferOptions,
  transferPoints,
  getRecentTransfers,
  findBestTransferRate,
} from '../services/gamificationService'
import type { ReferralStats, TransferOption, TransferHistory } from '../services/gamificationService'
import { getClientCards } from '../../loyalty/services/loyaltyService'

type TransferSourceProvider = {
  id: string
  name: string
  balance: number
}

interface UseReferralReturn {
  referralStats: ReferralStats | null
  sourceProviders: TransferSourceProvider[]
  transferOptions: TransferOption[]
  transferOptionsLoading: boolean
  recentTransfers: TransferHistory[]
  bestTransferOption: TransferOption | null
  loading: boolean
  error: Error | null
  generateLink: () => Promise<void>
  loadTransferOptions: (from_fournisseur_id: string) => Promise<void>
  transfer: (
    from_fournisseur_id: string,
    to_fournisseur_id: string,
    points_to_transfer: number,
  ) => Promise<any>
}

export function useReferral(): UseReferralReturn {
  const clientId = useAuthStore((state) => state.user?.id)
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null)
  const [sourceProviders, setSourceProviders] = useState<TransferSourceProvider[]>([])
  const [transferOptions, setTransferOptions] = useState<TransferOption[]>([])
  const [transferOptionsLoading, setTransferOptionsLoading] = useState(false)
  const [recentTransfers, setRecentTransfers] = useState<TransferHistory[]>([])
  const [bestTransferOption, setBestTransferOption] = useState<TransferOption | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadReferralStats = async () => {
      if (!clientId) {
        setReferralStats(null)
        return
      }

      try {
        const stats = await getReferralStats()
        setReferralStats(stats)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load referral stats'))
      }
    }

    loadReferralStats().catch(() => null)
  }, [clientId])

  useEffect(() => {
    const loadSources = async () => {
      if (!clientId) {
        setSourceProviders([])
        setTransferOptions([])
        return
      }

      try {
        const cards = await getClientCards(clientId)
        const providers: TransferSourceProvider[] = cards.map((card) => ({
          id: card.fournisseur.id,
          name: card.fournisseur.nom_commerce,
          balance: card.solde,
        }))
        setSourceProviders(providers)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load transfer sources'))
      }
    }

    loadSources().catch(() => null)
  }, [clientId])

  useEffect(() => {
    const loadTransferHistory = async () => {
      if (!clientId) {
        setRecentTransfers([])
        return
      }

      try {
        const transfers = await getRecentTransfers(5)
        setRecentTransfers(transfers)
      } catch (err) {
        console.error('Failed to load transfer history:', err)
      }
    }

    loadTransferHistory().catch(() => null)
  }, [clientId])

  useEffect(() => {
    const best = findBestTransferRate(transferOptions)
    setBestTransferOption(best)
  }, [transferOptions])

  const loadTransferOptions = async (from_fournisseur_id: string) => {
    if (!from_fournisseur_id) {
      setTransferOptions([])
      return
    }

    try {
      setTransferOptionsLoading(true)
      const options = await getTransferOptions(from_fournisseur_id)
      setTransferOptions(options)
      setError(null)
    } catch (err) {
      setTransferOptions([])
      setError(err instanceof Error ? err : new Error('Failed to load transfer options'))
    } finally {
      setTransferOptionsLoading(false)
    }
  }

  const generateLink = async () => {
    if (!clientId) return

    try {
      setLoading(true)
      const stats = await generateReferralLink()
      setReferralStats(stats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate referral link'))
    } finally {
      setLoading(false)
    }
  }

  const transfer = async (
    from_fournisseur_id: string,
    to_fournisseur_id: string,
    points_to_transfer: number,
  ) => {
    if (!clientId) throw new Error('No client ID')

    try {
      setLoading(true)
      const result = await transferPoints({
        client_id: clientId,
        from_fournisseur_id,
        to_fournisseur_id,
        points_to_transfer,
      })
      setError(null)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transfer failed')
      setError(error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  return {
    referralStats,
    sourceProviders,
    transferOptions,
    transferOptionsLoading,
    recentTransfers,
    bestTransferOption,
    loading,
    error,
    generateLink,
    loadTransferOptions,
    transfer,
  }
}
