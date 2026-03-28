import { useState } from 'react'
import { Link2, Shield, Sparkles, Store } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button } from '../../components/ui'
import { useMerchantStats } from '../../hooks/useMerchantStats'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { SumUpConnectionCard } from '../../modules/integrations/components/SumUpConnectionCard'
import { SumUpSandboxSimulatorCard } from '../../modules/integrations/components/SumUpSandboxSimulatorCard'
import { SettingsTabsShell } from '../../shared/components/SettingsTabsShell'

type MerchantSettingsTab = 'general' | 'integrations' | 'security' | 'shortcuts'

const settingsTabs: Array<{
  id: MerchantSettingsTab
  label: string
  description: string
  icon: typeof Store
}> = [
  {
    id: 'general',
    label: 'Général',
    description: 'Identité du commerce et indicateurs clés.',
    icon: Store,
  },
  {
    id: 'integrations',
    label: 'Intégrations',
    description: 'Connexion SumUp et outils de simulation.',
    icon: Link2,
  },
  {
    id: 'security',
    label: 'Sécurité',
    description: 'Mot de passe, session et accès.',
    icon: Shield,
  },
  {
    id: 'shortcuts',
    label: 'Raccourcis',
    description: 'Accès rapides vers les actions du quotidien.',
    icon: Sparkles,
  },
]

const connectorCatalog = [
  {
    name: 'SumUp',
    status: 'Disponible',
    detail: 'Connexion OAuth et vérification marchande déjà opérationnelles.',
    accent: 'border-[#FFD7C9] bg-[linear-gradient(135deg,#FFF8F4_0%,#FFFFFF_100%)]',
    badge: 'warning' as const,
  },
  {
    name: 'Caisse partenaire',
    status: 'À venir',
    detail: 'Bloc prévu pour brancher une caisse ou un POS tiers sans mélanger les réglages SumUp.',
    accent: 'border-gray-200 bg-white',
    badge: 'info' as const,
  },
  {
    name: 'E-commerce',
    status: 'À venir',
    detail: 'Emplacement réservé pour un connecteur boutique en ligne et synchronisation du catalogue.',
    accent: 'border-gray-200 bg-white',
    badge: 'info' as const,
  },
  {
    name: 'Automatisation CRM',
    status: 'À venir',
    detail: 'Zone future pour relier notifications, segmentation et campagnes fidélité.',
    accent: 'border-gray-200 bg-white',
    badge: 'info' as const,
  },
]

const settingsShellClass = 'rounded-[28px] border border-gray-200 bg-white p-5 shadow-[0_22px_60px_-46px_rgba(17,24,39,0.32)]'
const settingsPanelClass = 'rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_18px_52px_-42px_rgba(17,24,39,0.24)]'
const settingsAsideClass = 'rounded-[24px] border border-gray-200 bg-white p-5 shadow-[0_18px_52px_-42px_rgba(17,24,39,0.24)]'

function readProfileField(profile: unknown, key: string): string {
  if (!profile || typeof profile !== 'object') return 'Non renseigné'
  const value = (profile as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : 'Non renseigné'
}

export default function MerchantSettingsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const requestedTab = searchParams.get('tab')
  const activeTab: MerchantSettingsTab = settingsTabs.some((tab) => tab.id === requestedTab)
    ? (requestedTab as MerchantSettingsTab)
    : 'general'
  const activeTabMeta = settingsTabs.find((tab) => tab.id === activeTab) ?? settingsTabs[0]

  const selectTab = (tab: MerchantSettingsTab) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', tab)
    setSearchParams(nextParams, { replace: true })
  }

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

  const renderGeneralTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <section className={settingsPanelClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Identité</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Commerce</p>
            <p className="mt-2 font-body text-sm font-semibold text-dark">{storeName}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Responsable</p>
            <p className="mt-2 font-body text-sm font-semibold text-dark">{ownerName}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Ville</p>
            <p className="mt-2 font-body text-sm font-semibold text-dark">{city}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Téléphone</p>
            <p className="mt-2 font-body text-sm font-semibold text-dark">{phone}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Email de connexion</p>
            <p className="mt-2 font-body text-sm font-semibold text-dark">{user?.email ?? 'Non renseigné'}</p>
          </div>
        </div>
      </section>

      <section className={settingsPanelClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Snapshot activité</p>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="font-body text-sm text-gray-600">CA du mois</span>
            <strong className="font-display text-lg text-dark">{stats.monthlyRevenue.toLocaleString('fr-FR')} €</strong>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="font-body text-sm text-gray-600">Points distribués</span>
            <strong className="font-display text-lg text-dark">{stats.monthlyPointsDistributed.toLocaleString('fr-FR')}</strong>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="font-body text-sm text-gray-600">Clients fidèles</span>
            <strong className="font-display text-lg text-dark">{stats.loyalCustomers.toLocaleString('fr-FR')}</strong>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <span className="font-body text-sm text-gray-600">Réputation</span>
            <strong className="font-display text-lg text-dark">
              {stats.ratingCount > 0 ? `${stats.averageRating.toFixed(1)} ★ (${stats.ratingCount})` : 'Aucun avis'}
            </strong>
          </div>
        </div>
      </section>
    </div>
  )

  const renderIntegrationsTab = () => (
    <div className="space-y-4">
      <section className="rounded-[24px] border border-[#FFD7C9] bg-[linear-gradient(135deg,#FFF8F4_0%,#FFFFFF_55%,#FFF4EE_100%)] p-5 shadow-[0_24px_70px_-50px_rgba(255,107,53,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-[#B7592C]">Intégrations</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-dark">Pilotez vos connexions marchandes</h2>
            <p className="mt-2 max-w-2xl font-body text-sm text-gray-600">
              Centralisez ici la connexion SumUp et les outils de vérification associés, dans un espace dédié et plus lisible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">Paiement</Badge>
            <Badge variant="info">Sandbox</Badge>
          </div>
        </div>
      </section>

      <section className={settingsPanelClass}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Catalogue connecteurs</p>
            <h3 className="mt-2 font-display text-xl font-semibold text-dark">Un espace dédié pour vos intégrations</h3>
          </div>
          <Badge variant="info">1 disponible aujourd’hui</Badge>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {connectorCatalog.map((connector) => (
            <article
              key={connector.name}
              className={`rounded-[22px] border p-4 shadow-[0_18px_45px_-40px_rgba(17,24,39,0.25)] ${connector.accent}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-body text-sm font-semibold text-dark">{connector.name}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{connector.detail}</p>
                </div>
                <Badge variant={connector.badge}>{connector.status}</Badge>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SumUpConnectionCard userId={merchantId} />
          <SumUpSandboxSimulatorCard userId={merchantId} />
        </div>

        <aside className={settingsAsideClass}>
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Repères</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-dark">Connexion marchande</p>
              <p className="mt-1 text-sm text-gray-600">Le bouton de connexion récupère et stocke le merchant code quand SumUp le renvoie au callback.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-dark">Simulation</p>
              <p className="mt-1 text-sm text-gray-600">Les essais restent isolés en sandbox et n’impactent pas le flux réel du marchand.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-semibold text-dark">Déconnexion</p>
              <p className="mt-1 text-sm text-gray-600">La déconnexion disponible révoque aujourd’hui l’état côté Looyaal, pas encore côté OAuth SumUp.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )

  const renderSecurityTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className={settingsPanelClass}>
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
        </div>
      </section>

      <aside className={settingsAsideClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Session active</p>
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="font-body text-sm font-semibold text-amber-900">Poste partagé</p>
          <p className="mt-1 font-body text-sm text-amber-800">
            Déconnectez-vous sur cet appareil si vous travaillez sur un poste partagé.
          </p>
        </div>

        <Button
          className="mt-4 w-full border-[#FF6B35] bg-[#FF6B35] hover:brightness-105"
          onClick={() => void handleLogout()}
          loading={loading}
        >
          Se déconnecter
        </Button>
      </aside>
    </div>
  )

  const renderShortcutsTab = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className={settingsPanelClass}>
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

      <aside className={settingsAsideClass}>
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Conseil</p>
        <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-dark">Flux quotidien</p>
          <p className="mt-1 text-sm text-gray-600">
            Gardez cette page comme hub d’administration léger: paramètres d’un côté, actions opérationnelles de l’autre.
          </p>
        </div>
      </aside>
    </div>
  )

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'integrations':
        return renderIntegrationsTab()
      case 'security':
        return renderSecurityTab()
      case 'shortcuts':
        return renderShortcutsTab()
      case 'general':
      default:
        return renderGeneralTab()
    }
  }

  return (
    <section className="space-y-6">
      <header className={settingsShellClass}>
        <h1 className="font-display text-3xl font-extrabold text-dark">Paramètres marchand</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Gérez les informations du commerce et vos accès opérationnels.
        </p>
      </header>

      <SettingsTabsShell
        sidebarEyebrow="Paramètres"
        sidebarTitle="Paramètres"
        sidebarHint="Une organisation par onglets pour garder les réglages marchands lisibles et rapides à parcourir."
        navAriaLabel="Tabs paramètres marchand"
        tabs={settingsTabs}
        activeTab={activeTab}
        onSelectTab={selectTab}
        theme="merchant"
        sidebarFooter={(
          <div className="mt-3 rounded-[18px] border border-[#F0E2D8] bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-gray-500">Conseil</p>
            <p className="mt-2 text-sm text-gray-600">
              Utilisez l’onglet Intégrations comme espace principal pour les connecteurs, sans surcharger les réglages généraux.
            </p>
          </div>
        )}
        activeSectionClassName={settingsShellClass}
        activeTitle={activeTabMeta.label}
        activeDescription={activeTabMeta.description}
        activeBadge={(
          <Badge variant={activeTab === 'integrations' ? 'warning' : activeTab === 'security' ? 'default' : 'info'}>
            {activeTab === 'general' ? 'Vue commerce' : activeTab === 'integrations' ? 'Connecteurs' : activeTab === 'security' ? 'Accès' : 'Actions rapides'}
          </Badge>
        )}
      >
        {renderActiveTab()}
      </SettingsTabsShell>
    </section>
  )
}