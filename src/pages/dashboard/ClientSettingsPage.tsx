import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useAuth } from '../../modules/auth/hooks/useAuth'

function formatJoinedAt(value?: string | null): string {
  if (!value) {
    return 'Non renseigne'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Non renseigne'
  }

  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export default function ClientSettingsPage() {
  const navigate = useNavigate()
  const { user, profile, updatePassword, logout, loading, error } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const shortcutButtonClass = 'justify-start hover:bg-indigo-50 hover:border-primary/30 hover:text-primary'

  const displayName = useMemo(() => {
    const fullName = [profile?.prenom?.trim(), profile?.nom?.trim()].filter(Boolean).join(' ').trim()
    if (fullName) {
      return fullName
    }

    return profile?.nom?.trim() || user?.email?.split('@')[0] || 'Membre LoyalUp'
  }, [profile?.nom, profile?.prenom, user?.email])

  const handlePasswordSubmit = async () => {
    setLocalError(null)
    setSuccessMessage(null)

    if (password.trim().length < 8) {
      setLocalError('Le mot de passe doit contenir au moins 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setLocalError('La confirmation du mot de passe ne correspond pas.')
      return
    }

    try {
      await updatePassword(password)
      setPassword('')
      setConfirmPassword('')
      setSuccessMessage('Mot de passe mis a jour avec succes.')
    } catch {
      return
    }
  }

  const handleLogout = async () => {
    await logout()
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Compte</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Gerer votre profil, vos acces et la securite de votre session.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Profil</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Nom</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{displayName}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Email</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{user?.email ?? 'Non renseigne'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Role</p>
              <p className="mt-2 font-body text-sm font-semibold capitalize text-dark">{profile?.role ?? 'client'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Membre depuis</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{formatJoinedAt(profile?.created_at)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Raccourcis</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/history')}>
              Voir mon historique
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/rewards')}>
              Voir mes recompenses
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/networks')}>
              Gerer mes reseaux
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/scan')}>
              Scanner un QR
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/account-linking')}>
              Liaison compte partenaire
            </Button>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Securite</p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="client-password" className="mb-1 block text-sm text-gray-700">
                Nouveau mot de passe
              </label>
              <input
                id="client-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="Minimum 8 caracteres"
              />
            </div>
            <div>
              <label htmlFor="client-password-confirm" className="mb-1 block text-sm text-gray-700">
                Confirmer le mot de passe
              </label>
              <input
                id="client-password-confirm"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="Repetez le mot de passe"
              />
            </div>

            {localError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{localError}</p>
            ) : null}
            {successMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{successMessage}</p>
            ) : null}
            {error && !localError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <Button loading={loading} onClick={() => void handlePasswordSubmit()}>
              Mettre a jour le mot de passe
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Session</p>
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="font-body text-sm font-semibold text-amber-900">Session active</p>
            <p className="mt-1 font-body text-sm text-amber-800">
              Deconnectez-vous si vous etes sur un appareil partage ou public.
            </p>
          </div>
          <Button className="mt-4" variant="soft" onClick={() => void handleLogout()} loading={loading}>
            Se deconnecter
          </Button>
        </section>
      </div>
    </section>
  )
}
