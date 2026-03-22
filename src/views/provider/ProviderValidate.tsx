import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import {
  subscribeToPendingTransactions,
  type PendingTransactionPayload,
  unsubscribe,
} from '../../modules/qr/services/qrService'
import { ValidationPanel } from '../../modules/transactions/components/ValidationPanel'
import { supabase } from '../../shared/lib/supabaseClient'
import type { Profile } from '../../shared/types'

type PendingItem = PendingTransactionPayload & {
  clientName: string
  clientEmail: string
  clientPoints: number
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

export function ProviderValidate() {
  const { user } = useAuth()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [items, setItems] = useState<PendingItem[]>([])
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPendingTransactions = async (providerId: string) => {
    const nowIso = new Date().toISOString()
    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_transactions')
      .select('id, qr_token_id, client_id, fournisseur_id, status, created_at, expires_at')
      .eq('fournisseur_id', providerId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(25)

    if (pendingError) {
      throw new Error(pendingError.message)
    }

    const transactions = (pendingData ?? []) as PendingTransactionPayload[]
    const clientIds = [...new Set(transactions.map((transaction) => transaction.client_id))]

    const profileMap = new Map<string, { nom: string; email: string }>()
    if (clientIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, nom, prenom, email')
        .in('id', clientIds)

      for (const profile of profileData ?? []) {
        profileMap.set(profile.id as string, {
          nom: resolveClientName(
            profile.nom as string | undefined,
            profile.prenom as string | undefined,
            profile.email as string | undefined,
            String(profile.id),
          ),
          email: (profile.email as string | undefined) ?? '',
        })
      }
    }

    const pointsEntries = await Promise.all(
      clientIds.map(async (clientId) => {
        const { count } = await supabase
          .from('pending_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('fournisseur_id', providerId)
          .eq('client_id', clientId)
          .eq('status', 'validated')

        return [clientId, count ?? 0] as const
      }),
    )

    const pointsMap = new Map<string, number>(pointsEntries)

    const nextItems =
      transactions.map((transaction) => {
        const profile = profileMap.get(transaction.client_id)

        return {
          ...transaction,
          clientName: profile?.nom ?? resolveClientName(undefined, undefined, profile?.email, transaction.client_id),
          clientEmail: profile?.email ?? '',
          clientPoints: pointsMap.get(transaction.client_id) ?? 0,
        }
      })

    setItems(nextItems)
    setSelectedTransactionId((current) => {
      if (current && nextItems.some((item) => item.id === current)) {
        return current
      }

      return nextItems[0]?.id ?? null
    })
  }

  useEffect(() => {
    const initialize = async () => {
      setLoading(true)
      setError(null)

      try {
        if (!user?.id) {
          setLoading(false)
          return
        }

        const { data: fournisseurData, error: fournisseurError } = await supabase
          .from('fournisseurs')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (fournisseurError) {
          throw new Error(fournisseurError.message)
        }

        if (!fournisseurData?.id) {
          throw new Error('Profil fournisseur introuvable')
        }

        setFournisseurId(fournisseurData.id)
        await loadPendingTransactions(fournisseurData.id)
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Unable to load pending transactions'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    initialize().catch(() => null)
  }, [user?.id])

  useEffect(() => {
    if (!fournisseurId) {
      return
    }

    const handleIncoming = async (payload: PendingTransactionPayload) => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nom, prenom, email')
        .eq('id', payload.client_id)
        .maybeSingle()

      const { count } = await supabase
        .from('pending_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('fournisseur_id', payload.fournisseur_id)
        .eq('client_id', payload.client_id)
        .eq('status', 'validated')

      setItems((prev) => [
        {
          ...payload,
          clientName: resolveClientName(
            profileData?.nom as string | undefined,
            profileData?.prenom as string | undefined,
            profileData?.email as string | undefined,
            payload.client_id,
          ),
          clientEmail: (profileData?.email as string | undefined) ?? '',
          clientPoints: count ?? 0,
        },
        ...prev.filter((item) => item.id !== payload.id),
      ])

      setSelectedTransactionId((current) => current ?? payload.id)
    }

    subscribeToPendingTransactions(fournisseurId, handleIncoming)
    return () => {
      unsubscribe()
    }
  }, [fournisseurId])

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedTransactionId) ?? items[0] ?? null,
    [items, selectedTransactionId],
  )

  const selectedClientProfile = useMemo<Profile | null>(() => {
    if (!selectedItem) {
      return null
    }

    return {
      id: selectedItem.client_id,
      email: selectedItem.clientEmail || 'email non disponible',
      role: 'client',
      nom: selectedItem.clientName,
      created_at: selectedItem.created_at,
    }
  }, [selectedItem])

  const handleValidationPanelDismiss = async () => {
    if (!fournisseurId) {
      return
    }

    try {
      await loadPendingTransactions(fournisseurId)
      setError(null)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to refresh pending transactions'
      setError(message)
    }
  }

  const empty = useMemo(() => !loading && items.length === 0 && !error, [loading, items.length, error])

  return (
    <section className="w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-zinc-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Validations en attente</h1>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400">
          {items.length} pending
        </span>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {empty ? <p className="text-sm text-zinc-400">Aucune transaction en attente.</p> : null}

      {items.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTransactionId(item.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                selectedItem?.id === item.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {item.clientName}
            </button>
          ))}
        </div>
      ) : null}

      {selectedItem ? (
        <ValidationPanel
          pendingTransaction={selectedItem}
          clientProfile={selectedClientProfile}
          clientPoints={selectedItem.clientPoints}
          onDismiss={handleValidationPanelDismiss}
        />
      ) : null}
    </section>
  )
}
