import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { useMerchantStats } from '../../hooks/useMerchantStats'
import { useAuth } from '../../modules/auth/hooks/useAuth'

function readProfileField(profile: unknown, key: string): string {
  if (!profile || typeof profile !== 'object') return 'Non renseigné'
  const value = (profile as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : 'Non renseigné'
}

export default function MerchantSettingsPage() {
  const navigate = useNavigate()
  const { user, profile, logout, updatePassword, loading, error } = useAuth()
  const merchantId = user?.id ?? ''
  const { stats } = useMerchantStats(merchantId)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const storeName = readProfileField(profile, 'nom_commerce')
  const ownerName = readProfileField(profile, 'nom')
  const city = readProfileField(profile, 'ville')
  const phone = readProfileField(profile, 'telephone')
  const shortcutButtonClass = 'justify-start hover:bg-[#FFF4EE] hover:border-[#FF6B35]/35 hover:text-[#C84E20]'

  const handleLogout = async () => {
    await logout()
  }

  const handlePasswordUpdate = async () => {
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

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Paramètres marchand</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Gérez les informations du commerce et vos accès opérationnels.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Identité</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Commerce</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{storeName}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Responsable</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{ownerName}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Ville</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{city}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Téléphone</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{phone}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Email de connexion</p>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{user?.email ?? 'Non renseigné'}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Snapshot activité</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">CA du mois</span>
              <strong className="font-display text-lg text-dark">{stats.monthlyRevenue.toLocaleString('fr-FR')} €</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Points distribués</span>
              <strong className="font-display text-lg text-dark">{stats.monthlyPointsDistributed.toLocaleString('fr-FR')}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Clients fidèles</span>
              <strong className="font-display text-lg text-dark">{stats.loyalCustomers.toLocaleString('fr-FR')}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
              <span className="font-body text-sm text-gray-600">Réputation</span>
              <strong className="font-display text-lg text-dark">
                {stats.ratingCount > 0 ? `${stats.averageRating.toFixed(1)} ★ (${stats.ratingCount})` : 'Aucun avis'}
              </strong>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Raccourcis</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/merchant/qr')}>
              Ouvrir le générateur QR
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/merchant/catalog')}>
              Gérer le catalogue
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/merchant/offers')}>
              Gérer les offres points
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/merchant/networks')}>
              Voir les réseaux
            </Button>
            <Button variant="soft" className={shortcutButtonClass} onClick={() => navigate('/merchant/transactions')}>
              Consulter les transactions
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Sécurité</p>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="merchant-password" className="mb-1 block text-sm text-gray-700">
                Nouveau mot de passe
              </label>
              <input
                id="merchant-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
                placeholder="Minimum 8 caracteres"
              />
            </div>
            <div>
              <label htmlFor="merchant-password-confirm" className="mb-1 block text-sm text-gray-700">
                Confirmer le mot de passe
              </label>
              <input
                id="merchant-password-confirm"
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

            <Button onClick={() => void handlePasswordUpdate()} loading={loading}>
              Mettre a jour le mot de passe
            </Button>

            <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="font-body text-sm font-semibold text-amber-900">Session active</p>
            <p className="mt-1 font-body text-sm text-amber-800">
              Déconnectez-vous sur cet appareil si vous travaillez sur un poste partagé.
            </p>
          </div>
          </div>
          <Button className="mt-4 bg-[#FF6B35] border-[#FF6B35] hover:brightness-105" onClick={() => void handleLogout()} loading={loading}>
            Se déconnecter
          </Button>
        </section>
      </div>
    </section>
  )
}