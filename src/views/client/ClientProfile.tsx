import { useMemo, useState } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { updateCurrentUserPassword } from '../../modules/auth/services/authService'
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
  const { user, profile, role, loading, hydrateCurrentUser } = useAuth()
  const { segment, score, loading: segmentLoading } = useMySegment()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

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
  const sourcePartner = String(user?.user_metadata?.source_partner ?? '').trim()
  const isPartnerLinked = Boolean(sourcePartner)
  const isShadowAccount = displayEmail.toLowerCase().endsWith('@partner.loyalup.local')
  const mustChangePassword = Boolean(user?.user_metadata?.force_password_change)

  const handleSavePassword = async () => {
    setPasswordError(null)
    setPasswordSuccess(null)

    if (newPassword.trim().length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmation du mot de passe ne correspond pas.')
      return
    }

    setSavingPassword(true)

    try {
      await updateCurrentUserPassword(newPassword)
      await hydrateCurrentUser()
      setPasswordSuccess('Mot de passe mis à jour avec succès.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Impossible de mettre à jour le mot de passe.')
    } finally {
      setSavingPassword(false)
    }
  }

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
            {isPartnerLinked ? (
              <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-indigo-700">Compte lié partenaire</p>
                <p className="mt-1 text-sm text-indigo-800">
                  Ce compte a été alimenté via le partenaire {sourcePartner}.
                </p>
              </div>
            ) : null}
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 text-[17px] font-semibold text-slate-900">Sécurité du compte</h2>

            {mustChangePassword ? (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Mot de passe temporaire détecté: vous devez définir un nouveau mot de passe pour continuer.
              </div>
            ) : null}

            {isShadowAccount ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Votre compte est encore en mode lié partenaire. Finalisez d’abord l’activation depuis l’application partenaire pour définir une adresse email personnelle.
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm text-slate-600">
                  Définissez un mot de passe LoyalUp pour pouvoir vous connecter directement sans repasser par le partenaire.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="new-password" className="text-xs uppercase tracking-wide text-slate-500">
                      Nouveau mot de passe
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Minimum 8 caractères"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirm-password" className="text-xs uppercase tracking-wide text-slate-500">
                      Confirmer
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      placeholder="Répétez le mot de passe"
                    />
                  </div>
                </div>

                {passwordError ? (
                  <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passwordError}</p>
                ) : null}
                {passwordSuccess ? (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passwordSuccess}</p>
                ) : null}

                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={savingPassword}
                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPassword ? 'Enregistrement...' : 'Mettre à jour le mot de passe'}
                </button>
              </>
            )}
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
