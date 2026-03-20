import { useEffect, useMemo, useState } from 'react'
import { Link2, ShieldAlert, ShieldCheck, ShieldQuestion, TimerReset } from 'lucide-react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { supabase } from '../../shared/lib/supabaseClient'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

type IdentityStatus = 'pending_verification' | 'resolved' | 'conflict' | 'merged' | 'rejected'

type IdentityRow = {
  partner_id: string
  external_user_id: string
  loyalup_user_id: string
  link_status: string | null
  link_method: string | null
  verified_at: string | null
  last_status_change_at: string | null
  link_conflict_reason: string | null
  open_case_id: string | null
  case_status: string | null
  case_decision: string | null
  case_conflict_reason: string | null
  case_updated_at: string | null
  current_status: IdentityStatus
}

type IdentityResponse = {
  success: boolean
  identities: IdentityRow[]
  summary: {
    total: number
    statuses: Record<IdentityStatus, number>
    has_unresolved: boolean
  }
}

function statusLabel(status: IdentityStatus): string {
  if (status === 'resolved') return 'Résolu'
  if (status === 'pending_verification') return 'Vérification en attente'
  if (status === 'conflict') return 'Conflit'
  if (status === 'merged') return 'Fusionné'
  return 'Rejeté'
}

function statusBadgeVariant(status: IdentityStatus): 'success' | 'warn' | 'neutral' {
  if (status === 'resolved') return 'success'
  if (status === 'pending_verification') return 'warn'
  if (status === 'conflict') return 'warn'
  return 'neutral'
}

function statusIcon(status: IdentityStatus) {
  if (status === 'resolved') return <ShieldCheck className="h-4 w-4 text-emerald-600" />
  if (status === 'pending_verification') return <TimerReset className="h-4 w-4 text-amber-600" />
  if (status === 'conflict') return <ShieldAlert className="h-4 w-4 text-rose-600" />
  return <ShieldQuestion className="h-4 w-4 text-slate-500" />
}

function formatDate(value: string | null): string {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return date.toLocaleString('fr-FR')
}

export default function AccountLinkingPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<IdentityRow[]>([])
  const [summary, setSummary] = useState<IdentityResponse['summary'] | null>(null)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)

      const { data, error: invokeError } = await supabase.functions.invoke<IdentityResponse>('my-partner-identity', {
        method: 'POST',
        body: {},
      })

      if (cancelled) return

      if (invokeError) {
        setError(invokeError.message)
        setRows([])
        setSummary(null)
        setLoading(false)
        return
      }

      if (!data?.success) {
        setError('Impossible de récupérer le statut de liaison partenaire.')
        setRows([])
        setSummary(null)
        setLoading(false)
        return
      }

      setRows(data.identities ?? [])
      setSummary(data.summary ?? null)
      setLoading(false)
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [])

  const sourcePartner = useMemo(() => String(user?.user_metadata?.source_partner ?? '').trim(), [user?.user_metadata])

  return (
    <section className="space-y-4">
      <PageHeader
        title="Liaison compte partenaire"
        subtitle="Suivez l'état de liaison entre votre compte LoyalUp et les identifiants envoyés par un partenaire."
        rightActions={<Badge variant="neutral">Identité</Badge>}
      />

      {sourcePartner ? (
        <SectionCard>
          <p className="text-sm text-slate-600">
            Source partenaire détectée: <span className="font-semibold text-slate-900">{sourcePartner}</span>
          </p>
        </SectionCard>
      ) : null}

      {loading ? (
        <SectionCard>
          <p className="text-sm text-slate-600">Chargement des liaisons en cours...</p>
        </SectionCard>
      ) : null}

      {!loading && error ? (
        <SectionCard>
          <p className="text-sm text-rose-700">{error}</p>
        </SectionCard>
      ) : null}

      {!loading && !error && summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{summary.total}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">Résolus</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{summary.statuses.resolved}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">En attente</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{summary.statuses.pending_verification}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">Conflits</p>
            <p className="mt-1 text-xl font-bold text-rose-700">{summary.statuses.conflict}</p>
          </SectionCard>
          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">Autres</p>
            <p className="mt-1 text-xl font-bold text-slate-700">{summary.statuses.merged + summary.statuses.rejected}</p>
          </SectionCard>
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <SectionCard>
          <p className="text-sm text-slate-600">Aucune liaison partenaire trouvée pour ce compte.</p>
        </SectionCard>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <SectionCard key={`${row.partner_id}:${row.external_user_id}`} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {statusIcon(row.current_status)}
                  <p className="text-sm font-semibold text-slate-900">External user: {row.external_user_id}</p>
                </div>
                <Badge variant={statusBadgeVariant(row.current_status)}>{statusLabel(row.current_status)}</Badge>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                <p><span className="font-medium text-slate-700">Partner ID:</span> {row.partner_id}</p>
                <p><span className="font-medium text-slate-700">Méthode:</span> {row.link_method ?? 'N/A'}</p>
                <p><span className="font-medium text-slate-700">Vérifié:</span> {formatDate(row.verified_at)}</p>
                <p><span className="font-medium text-slate-700">Dernier changement:</span> {formatDate(row.last_status_change_at)}</p>
                <p><span className="font-medium text-slate-700">Case ID:</span> {row.open_case_id ?? 'Aucun'}</p>
                <p><span className="font-medium text-slate-700">Décision:</span> {row.case_decision ?? 'N/A'}</p>
              </div>

              {row.case_conflict_reason || row.link_conflict_reason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  Motif conflit: {row.case_conflict_reason ?? row.link_conflict_reason}
                </div>
              ) : null}
            </SectionCard>
          ))}
        </div>
      ) : null}

      {!loading && !error && summary?.has_unresolved ? (
        <SectionCard className="space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">Action recommandée</p>
          </div>
          <p className="text-sm text-slate-600">
            Certaines liaisons nécessitent encore une validation ou une revue manuelle. Si l'état reste bloqué, contactez le support LoyalUp.
          </p>
        </SectionCard>
      ) : null}
    </section>
  )
}
