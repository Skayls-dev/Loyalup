import { useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useMySegment } from '../../modules/analytics/hooks/useMySegment'
import { ConsentSettings } from '../../shared/components/ConsentSettings'
import { DataExportButton } from '../../shared/components/DataExportButton'
import { DeleteAccountModal } from '../../shared/components/DeleteAccountModal'

function formatRoleLabel(role: string | null) {
  if (role === 'fournisseur') {
    return 'Fournisseur'
  }

  if (role === 'client') {
    return 'Client'
  }

  return 'Non défini'
}

export function ClientProfile() {
  const { user, profile, role, loading } = useAuth()
  const { segment, score, loading: segmentLoading } = useMySegment()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const joinedAt = useMemo(() => {
    if (!profile?.created_at) {
      return '—'
    }

    const date = new Date(profile.created_at)
    if (Number.isNaN(date.getTime())) {
      return '—'
    }

    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }, [profile?.created_at])

  const displayName = profile?.nom?.trim() || user?.email?.split('@')[0] || 'Utilisateur'
  const displayEmail = profile?.email?.trim() || user?.email || '—'

  return (
    <section className="min-h-[50vh] rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-100">
      <h1 className="text-2xl font-semibold">Profil</h1>

      {loading ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-zinc-800/70" />
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Nom</p>
            <p className="mt-1 text-base font-medium text-zinc-100">{displayName}</p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Email</p>
            <p className="mt-1 text-base text-zinc-100">{displayEmail}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Rôle</p>
              <p className="mt-1 text-base text-zinc-100">{formatRoleLabel(role)}</p>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-400">Compte créé le</p>
              <p className="mt-1 text-base text-zinc-100">{joinedAt}</p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">ID utilisateur</p>
            <p className="mt-1 break-all text-sm text-zinc-300">{user?.id || '—'}</p>
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Segment client</p>
            <p className="mt-1 text-base text-zinc-100">
              {segmentLoading ? 'Chargement...' : segment ? segment.replace('_', ' ') : 'Non classé'}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Score: {score ?? '—'}</p>
          </div>

          <ConsentSettings locale="fr" />
          <DataExportButton />

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
            <p className="text-sm font-semibold">Suppression du compte</p>
            <p className="mt-1 text-xs text-zinc-400">Conforme RGPD · Art. 17</p>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="mt-3 rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-950/60"
            >
              Demander la suppression
            </button>
          </div>

          <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
        </div>
      )}
    </section>
  )
}
