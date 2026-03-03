import { useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useMySegment } from '../../modules/analytics/hooks/useMySegment'
import { ConsentSettings } from '../../shared/components/ConsentSettings'
import { DataExportButton } from '../../shared/components/DataExportButton'
import { DeleteAccountModal } from '../../shared/components/DeleteAccountModal'
import { DangerButton, PageHeader, SectionCard, Skeleton } from '../../shared/components/client-ui'

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
    <section className="min-h-[50vh] space-y-4">
      <PageHeader title="Profil" subtitle="Informations personnelles et préférences de confidentialité" />

      {loading ? (
        <Skeleton className="h-20" />
      ) : (
        <div className="mt-5 space-y-4">
          <SectionCard>
            <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Identité</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Nom</p>
                <p className="mt-1 text-base font-medium text-slate-900">{displayName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                <p className="mt-1 text-base text-slate-900">{displayEmail}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Rôle</p>
                <p className="mt-1 text-base text-slate-900">{formatRoleLabel(role)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Compte créé le</p>
                <p className="mt-1 text-base text-slate-900">{joinedAt}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">ID utilisateur</p>
              <p className="mt-1 break-all text-sm text-slate-700">{user?.id || '—'}</p>
            </div>
          </SectionCard>

          <SectionCard>
            <p className="text-xs uppercase tracking-wide text-slate-500">Segment client</p>
            <p className="mt-1 text-base text-slate-900">
              {segmentLoading ? 'Chargement...' : segment ? segment.replace('_', ' ') : 'Non classé'}
            </p>
            <p className="mt-1 text-xs text-slate-500">Score: {score ?? '—'}</p>
          </SectionCard>

          <ConsentSettings locale="fr" />
          <DataExportButton />

          <SectionCard>
            <p className="text-sm font-semibold text-slate-900">Suppression du compte</p>
            <p className="mt-1 text-xs text-slate-500">Conforme RGPD · Art. 17</p>
            <DangerButton
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="mt-3"
            >
              Demander la suppression
            </DangerButton>
          </SectionCard>

          <DeleteAccountModal open={deleteOpen} onClose={() => setDeleteOpen(false)} />
        </div>
      )}
    </section>
  )
}
