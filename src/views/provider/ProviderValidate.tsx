import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import {
  subscribeToPendingTransactions,
  type PendingTransactionPayload,
  unsubscribe,
} from '../../modules/qr/services/qrService'
import { cancelTransaction, creditPoints } from '../../modules/transactions/services/transactionService'
import { supabase } from '../../shared/lib/supabaseClient'

type PendingItem = PendingTransactionPayload & {
  clientName: string
  clientEmail: string
  clientPoints: number
}

export function ProviderValidate() {
  const { user } = useAuth()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const loadPendingTransactions = async (providerId: string) => {
    const { data: pendingData, error: pendingError } = await supabase
      .from('pending_transactions')
      .select('id, qr_token_id, client_id, fournisseur_id, status, created_at, expires_at')
      .eq('fournisseur_id', providerId)
      .eq('status', 'pending')
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
        .select('id, nom, email')
        .in('id', clientIds)

      for (const profile of profileData ?? []) {
        profileMap.set(profile.id as string, {
          nom: (profile.nom as string | undefined) ?? 'Client inconnu',
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

    setItems(
      transactions.map((transaction) => {
        const profile = profileMap.get(transaction.client_id)

        return {
          ...transaction,
          clientName: profile?.nom ?? 'Client inconnu',
          clientEmail: profile?.email ?? '',
          clientPoints: pointsMap.get(transaction.client_id) ?? 0,
        }
      }),
    )
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
        .select('nom, email')
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
          clientName: (profileData?.nom as string | undefined) ?? 'Client inconnu',
          clientEmail: (profileData?.email as string | undefined) ?? '',
          clientPoints: count ?? 0,
        },
        ...prev.filter((item) => item.id !== payload.id),
      ])
    }

    subscribeToPendingTransactions(fournisseurId, handleIncoming)
    return () => {
      unsubscribe()
    }
  }, [fournisseurId])

  const handleAction = async (transactionId: string, action: 'validate' | 'cancel') => {
    setActionLoadingId(transactionId)
    setError(null)

    try {
      if (action === 'validate') {
        await creditPoints({
          pending_transaction_id: transactionId,
          montant: 1,
        })
      } else {
        await cancelTransaction(transactionId)
      }

      setItems((prev) => prev.filter((item) => item.id !== transactionId))
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Action failed'
      setError(message)
    } finally {
      setActionLoadingId(null)
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

      <div className="space-y-3">
        {items.map((item) => {
          const isBusy = actionLoadingId === item.id

          return (
            <article
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">{item.clientName}</p>
                  <p className="text-xs text-zinc-400">{item.clientEmail || 'email non disponible'}</p>
                  <p className="mt-2 text-xs text-zinc-400">Points actuels: {item.clientPoints}</p>
                </div>

                <div className="text-right text-xs text-zinc-500">
                  <p>Créée: {new Date(item.created_at).toLocaleTimeString()}</p>
                  <p>Expire: {new Date(item.expires_at).toLocaleTimeString()}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleAction(item.id, 'validate')}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? '...' : 'Valider'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleAction(item.id, 'cancel')}
                  className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Annuler
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
