import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

type MerchantClientDetailPageProps = {
  merchantId: string
  clientId: string
}

type ClientProfile = {
  id: string
  nom: string | null
  email: string | null
  created_at?: string | null
}

type ClientPointsRow = {
  solde: number
  total_visites: number
  updated_at: string | null
}

type ClientTransactionRow = {
  id: string
  montant: number
  points_credited: number
  created_at: string
}

function displayClientName(profile: ClientProfile | null, clientId: string) {
  const name = profile?.nom?.trim()
  if (name) {
    return name
  }

  return `Client ${clientId.slice(0, 6)}`
}

export default function MerchantClientDetailPage({ merchantId, clientId }: MerchantClientDetailPageProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [pointsRow, setPointsRow] = useState<ClientPointsRow | null>(null)
  const [transactions, setTransactions] = useState<ClientTransactionRow[]>([])

  useEffect(() => {
    let cancelled = false

    const loadClientDetail = async () => {
      setLoading(true)
      setError(null)

      const [profileRes, pointsRes, transactionsRes] = await Promise.all([
        supabase.from('profiles').select('id, nom, email, created_at').eq('id', clientId).maybeSingle<ClientProfile>(),
        supabase
          .from('client_points')
          .select('solde, total_visites, updated_at')
          .eq('client_id', clientId)
          .eq('fournisseur_id', merchantId)
          .maybeSingle<ClientPointsRow>(),
        supabase
          .from('transactions')
          .select('id, montant, points_credited, created_at')
          .eq('client_id', clientId)
          .eq('fournisseur_id', merchantId)
          .eq('status', 'validated')
          .order('created_at', { ascending: false })
          .limit(10),
      ])

      if (cancelled) {
        return
      }

      if (profileRes.error || pointsRes.error || transactionsRes.error) {
        setError(profileRes.error?.message ?? pointsRes.error?.message ?? transactionsRes.error?.message ?? 'Impossible de charger ce client.')
        setProfile(null)
        setPointsRow(null)
        setTransactions([])
        setLoading(false)
        return
      }

      setProfile(profileRes.data ?? null)
      setPointsRow(pointsRes.data ?? null)
      setTransactions(
        ((transactionsRes.data ?? []) as Array<{ id: string; montant: number | null; points_credited: number | null; created_at: string }>).map((row) => ({
          id: row.id,
          montant: Number(row.montant ?? 0),
          points_credited: Number(row.points_credited ?? 0),
          created_at: row.created_at,
        })),
      )
      setLoading(false)
    }

    void loadClientDetail()

    return () => {
      cancelled = true
    }
  }, [clientId, merchantId])

  const clientName = displayClientName(profile, clientId)

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-dark">{clientName}</h1>
            <p className="mt-2 font-body text-sm text-gray-600">
              {profile?.email?.trim() || 'Profil client'}
            </p>
          </div>

          <Link
            to="/merchant/clients"
            className="inline-flex rounded-lg border border-gray-200 bg-white px-4 py-2 font-body text-sm font-semibold text-dark transition hover:border-violet-300 hover:bg-violet-50/35"
          >
            Retour aux clients
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-gray-200 bg-white">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 font-body text-sm text-rose-700">{error}</p>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-4 xl:grid-cols-[320px,1fr]">
          <section className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Solde actuel</p>
              <p className="mt-2 font-display text-3xl font-extrabold text-violet-600">
                {(pointsRow?.solde ?? 0).toLocaleString('fr-FR')} pts
              </p>
            </div>

            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Visites</p>
              <p className="mt-2 font-body text-lg font-semibold text-dark">
                {(pointsRow?.total_visites ?? 0).toLocaleString('fr-FR')}
              </p>
            </div>

            <div>
              <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Dernière activité</p>
              <p className="mt-2 font-body text-sm text-gray-600">
                {pointsRow?.updated_at ? new Date(pointsRow.updated_at).toLocaleString('fr-FR') : 'Aucune activité'}
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <header className="mb-3">
              <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Transactions récentes</p>
            </header>

            <div className="space-y-2">
              {transactions.map((transaction) => (
                <article key={transaction.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                  <div>
                    <p className="font-body text-sm font-semibold text-dark">
                      {transaction.montant.toLocaleString('fr-FR')} €
                    </p>
                    <p className="mt-0.5 font-body text-xs text-gray-500">
                      {new Date(transaction.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>

                  <p className="font-body text-sm font-semibold text-emerald-600">
                    +{transaction.points_credited.toLocaleString('fr-FR')} pts
                  </p>
                </article>
              ))}

              {transactions.length === 0 ? (
                <p className="font-body text-sm text-gray-500">Aucune transaction trouvée pour ce client.</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}