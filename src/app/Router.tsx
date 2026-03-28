import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginForm } from '../modules/auth/components/LoginForm'
import { RegisterForm } from '../modules/auth/components/RegisterForm'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { MerchantNetworks } from '../components/merchant/MerchantNetworks'
import { MerchantConsumedServicesCard } from '../components/merchant/MerchantConsumedServicesCard'
import { MerchantConsumedRewardsCard } from '../components/merchant/MerchantConsumedRewardsCard'
import { MerchantOffers } from '../components/merchant/MerchantOffers'
import { MerchantRedemptionRules } from '../components/merchant/MerchantRedemptionRules'
import { MerchantRevenueChart } from '../components/merchant/MerchantRevenueChart'
import { MerchantTransactions } from '../components/merchant/MerchantTransactions'
import { TopCustomers } from '../components/merchant/TopCustomers'
import { ServiceManager } from '../modules/providers/components/ServiceManager'
import type { SocialRole } from '../modules/auth/services/authService'
import { useEventTracker } from '../shared/hooks/useEventTracker'
import { supabase } from '../shared/lib/supabaseClient'

const AdminDashboard = lazy(() =>
  import('../views/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
)
const AdminNetwork = lazy(() =>
  import('../views/admin/AdminNetwork').then((module) => ({ default: module.AdminNetwork })),
)
const NetworksListPage = lazy(() =>
  import('../pages/admin/NetworksListPage').then((module) => ({ default: module.default })),
)
const NetworkCreatePage = lazy(() =>
  import('../pages/admin/NetworkCreatePage').then((module) => ({ default: module.default })),
)
const NetworkConfigPage = lazy(() =>
  import('../pages/admin/NetworkConfigPage').then((module) => ({ default: module.default })),
)
const AdminLayout = lazy(() =>
  import('../views/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })),
)
const InstitutionDashboard = lazy(() =>
  import('../modules/institutions/components/InstitutionDashboard').then((module) => ({ default: module.InstitutionDashboard })),
)
const LandingPage = lazy(() =>
  import('../pages/LandingPage').then((module) => ({ default: module.default })),
)
const ReferralJoinPage = lazy(() =>
  import('../pages/ReferralJoinPage').then((module) => ({ default: module.default })),
)
const UnauthorizedPage = lazy(() =>
  import('../pages/UnauthorizedPage').then((module) => ({ default: module.default })),
)
const OnboardingRouter = lazy(() =>
  import('./OnboardingRouter').then((module) => ({ default: module.default })),
)

// ── New design layouts & pages ────────────────────────────────────────────────
const DashboardLayout = lazy(() =>
  import('../layouts/DashboardLayout').then((module) => ({ default: module.DashboardLayout })),
)
const MerchantLayout = lazy(() =>
  import('../layouts/MerchantLayout').then((module) => ({ default: module.MerchantLayout })),
)
const DashboardHome = lazy(() =>
  import('../pages/dashboard/DashboardHome').then((module) => ({ default: module.DashboardHome })),
)
const GamificationPage = lazy(() =>
  import('../pages/dashboard/GamificationPage').then((module) => ({ default: module.default })),
)
const DashboardNotificationsPage = lazy(() =>
  import('../pages/dashboard/NotificationsPage').then((module) => ({ default: module.default })),
)
const ReferralProgramPage = lazy(() =>
  import('../pages/dashboard/ReferralProgramPage').then((module) => ({ default: module.default })),
)
const ReferrerAnalyticsDashboard = lazy(() =>
  import('../pages/dashboard/ReferrerAnalyticsDashboard').then((module) => ({ default: module.ReferrerAnalyticsDashboard })),
)
const ClientSettingsPage = lazy(() =>
  import('../pages/dashboard/ClientSettingsPage').then((module) => ({ default: module.default })),
)
const ClientPointsPage = lazy(() =>
  import('../pages/dashboard/ClientPointsPage').then((module) => ({ default: module.default })),
)
const PointTransfersPage = lazy(() =>
  import('../pages/dashboard/PointTransfersPage').then((module) => ({ default: module.default })),
)
const ClientNetworksPage = lazy(() =>
  import('../pages/dashboard/ClientNetworksPage').then((module) => ({ default: module.default })),
)
const ClientTransactionsPage = lazy(() =>
  import('../pages/dashboard/ClientTransactionsPage').then((module) => ({ default: module.default })),
)
const ClientRewardsPage = lazy(() =>
  import('../pages/dashboard/ClientRewardsPage').then((module) => ({ default: module.default })),
)
const ClientHistoryPage = lazy(() =>
  import('../pages/dashboard/ClientHistoryPage').then((module) => ({ default: module.default })),
)
const MerchantDirectoryPage = lazy(() =>
  import('../pages/dashboard/MerchantDirectoryPage').then((module) => ({ default: module.default })),
)
const OffersExplorerPage = lazy(() =>
  import('../pages/dashboard/OffersExplorerPage').then((module) => ({ default: module.default })),
)
const AccountLinkingPage = lazy(() =>
  import('../pages/dashboard/AccountLinkingPage').then((module) => ({ default: module.default })),
)
const QRScannerPage = lazy(() =>
  import('../pages/QRScannerPage').then((module) => ({ default: module.default })),
)
const SumUpOAuthCallbackPage = lazy(() =>
  import('../pages/SumUpOAuthCallbackPage').then((module) => ({ default: module.default })),
)
const MerchantHome = lazy(() =>
  import('../pages/merchant/MerchantHome').then((module) => ({ default: module.MerchantHome })),
)
const MerchantQrPage = lazy(() =>
  import('../pages/merchant/MerchantQrPage').then((module) => ({ default: module.default })),
)
const MerchantSettingsPage = lazy(() =>
  import('../pages/merchant/MerchantSettingsPage').then((module) => ({ default: module.default })),
)
const MerchantSubscriptionPage = lazy(() =>
  import('../pages/merchant/MerchantSubscriptionPage').then((module) => ({ default: module.default })),
)
const MerchantClientDetailPage = lazy(() =>
  import('../pages/merchant/MerchantClientDetailPage').then((module) => ({ default: module.default })),
)

const PENDING_REFERRAL_STORAGE_KEY = 'loyalup_pending_referral_code'

function getPendingReferralPath(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  const code = window.localStorage.getItem(PENDING_REFERRAL_STORAGE_KEY)?.trim()
  if (!code) {
    return null
  }

  return `/join/${encodeURIComponent(code)}`
}

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
    </div>
  )
}

function AuthRoute() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [selectedRole, setSelectedRole] = useState<'client' | 'fournisseur'>('client')
  const [socialRole, setSocialRole] = useState<SocialRole>('client')
  const [socialName, setSocialName] = useState('')
  const [socialError, setSocialError] = useState<string | null>(null)
  const { user, role, loading, completeSocialProfile } = useAuth()

  useEffect(() => {
    if (location.pathname === '/signup') {
      setAuthMode('signup')
      return
    }

    if (location.pathname === '/login' || location.pathname === '/auth') {
      setAuthMode('login')
    }
  }, [location.pathname])

  const emailLocalPart = useMemo(() => {
    if (!user?.email) {
      return ''
    }

    return user.email.split('@')[0] ?? ''
  }, [user?.email])

  const currentModeLabel = authMode === 'signup' ? 'Inscription' : 'Connexion'
  const currentRoleLabel = selectedRole === 'fournisseur' ? 'Fournisseur' : 'Client'

  useEffect(() => {
    if (!socialName && emailLocalPart) {
      setSocialName(emailLocalPart)
    }
  }, [emailLocalPart, socialName])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  if (user && role === 'client') {
    return <Navigate to={getPendingReferralPath() ?? '/dashboard'} replace />
  }

  if (user && role === 'fournisseur') {
    return <Navigate to="/merchant" replace />
  }

  if (user && (role === 'admin' || role === 'super_admin')) {
    return <Navigate to="/admin/auth" replace />
  }

  if (user && role === 'institution') {
    return <Navigate to="/institution" replace />
  }

  if (user && !role) {
    const handleCompleteSocialProfile = async () => {
      setSocialError(null)

      try {
        await completeSocialProfile(socialRole, socialName)
      } catch (error) {
        setSocialError(error instanceof Error ? error.message : 'Impossible de finaliser le compte.')
      }
    }

    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5F7FF] via-[#F8FAFF] to-white px-4 py-10">
        <span className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-green/10 blur-3xl" />

        <div className="relative z-10 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-card">
          <h2 className="text-xl font-semibold text-gray-900">Finaliser votre compte</h2>
          <p className="mt-1 text-sm text-gray-600">
            Choisissez votre rôle et votre nom pour terminer la connexion sociale.
          </p>

          <div className="mt-4 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setSocialRole('client')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                socialRole === 'client'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:bg-primary-light hover:text-primary'
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => setSocialRole('fournisseur')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                socialRole === 'fournisseur'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-600 hover:bg-primary-light hover:text-primary'
              }`}
            >
              Fournisseur
            </button>
          </div>

          <div className="mt-4">
            <label htmlFor="social-name" className="mb-1 block text-sm text-gray-700">
              Nom
            </label>
            <input
              id="social-name"
              type="text"
              required
              value={socialName}
              onChange={(event) => setSocialName(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
              placeholder="Votre nom"
            />
          </div>

          {socialError ? (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {socialError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={loading}
            onClick={handleCompleteSocialProfile}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 font-medium text-white transition hover:from-indigo-600 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Finalisation...
              </>
            ) : (
              'Finaliser le compte'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Brand panel ──────────────────────────────────────────────── */}
      <div className="relative hidden lg:flex lg:w-[460px] xl:w-[500px] shrink-0 flex-col justify-between overflow-hidden bg-[#0b0715] px-10 py-12">
        {/* Ambient blobs */}
        <div className="pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-violet-700/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-fuchsia-700/15 blur-2xl" />
        {/* Dot-grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Wordmark */}
        <Link to="/" className="relative z-10 inline-flex w-fit items-center gap-2">
          <span className="text-2xl font-black tracking-tight text-white">Looyaal</span>
          <span className="h-2 w-2 rounded-full bg-violet-400" aria-hidden="true" />
        </Link>

        {/* Headline + bullets */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h1 className="text-[2.5rem] font-extrabold leading-[1.15] text-white">
              La fidélité<br />
              <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
                réinventée.
              </span>
            </h1>
            <p className="text-[0.9375rem] leading-relaxed text-zinc-400">
              Rejoignez des milliers de clients et commerçants qui font vivre la fidélité autrement.
            </p>
          </div>

          <ul className="space-y-3.5">
            {(
              [
                { symbol: '✦', text: 'Points de fidélité en temps réel' },
                { symbol: '◈', text: 'Récompenses et badges exclusifs' },
                { symbol: '⬡', text: 'Réseau de partenaires unifié' },
              ] as const
            ).map(({ symbol, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-violet-300">
                  {symbol}
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-zinc-700">© 2026 Looyaal · Tous droits réservés</p>
      </div>

      {/* ── Form panel ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-white px-6 py-12">
        {/* Mobile-only logo */}
        <Link to="/" className="mb-8 inline-flex items-center gap-1.5 lg:hidden">
          <span className="text-2xl font-black tracking-tight text-zinc-900">Looyaal</span>
          <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
        </Link>

        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 font-body text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
        >
          ← Retour au site
        </Link>

        <div className="w-full max-w-sm">
          {/* Role tabs first */}
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Je me connecte en tant que
            </p>
            <div className="relative flex rounded-xl bg-zinc-100 p-1">
              <span
                className={`absolute inset-y-1 w-[calc(50%-2px)] rounded-lg bg-white shadow-sm transition-all duration-200 ease-out ${
                  selectedRole === 'fournisseur' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                }`}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => setSelectedRole('client')}
                className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${
                  selectedRole === 'client' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('fournisseur')}
                className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${
                  selectedRole === 'fournisseur' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
                }`}
              >
                Fournisseur
              </button>
            </div>
          </div>

          {/* Then login / signup tabs */}
          <div className="relative mb-5 flex rounded-xl bg-zinc-100 p-1">
            <span
              className={`absolute inset-y-1 w-[calc(50%-2px)] rounded-lg bg-white shadow-sm transition-all duration-200 ease-out ${
                authMode === 'signup' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
              }`}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${
                authMode === 'login' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Connexion
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`relative z-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors duration-200 ${
                authMode === 'signup' ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              Inscription
            </button>
          </div>

          <p className="mb-5 text-center font-body text-xs text-zinc-500">
            Mode actuel: <span className="font-semibold text-zinc-700">{currentModeLabel}</span>
            {' '}·{' '}
            <span className="font-semibold text-violet-700">{currentRoleLabel}</span>
          </p>

          <div className="mb-5 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
            <p className="font-body text-xs text-violet-800">
              Nouveau ici ? Lancez directement le parcours guidé sans connexion préalable.
            </p>
            <button
              type="button"
              onClick={() => navigate('/onboarding/1')}
              className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-violet-600 px-3 font-body text-sm font-semibold text-white transition hover:brightness-105"
            >
              Commencer l'onboarding
            </button>
          </div>

          {authMode === 'signup' ? (
            <RegisterForm role={selectedRole} bare />
          ) : (
            <LoginForm allowedRoles={[selectedRole]} bare />
          )}
        </div>
      </div>
    </div>
  )
}

function AuthCallbackRoute() {
  const { hydrateCurrentUser, user, role } = useAuth()
  const [ready, setReady] = useState(false)

  const redirectTo = useMemo(() => {
    if (!ready) {
      return '/auth'
    }

    const sourcePartner = String(user?.user_metadata?.source_partner ?? '').trim()
    const activationRequired = Boolean(user?.user_metadata?.activation_required)
    const email = String(user?.email ?? '').toLowerCase()
    const isShadowEmail = email.endsWith('@partner.loyalup.local')

    if (sourcePartner && (activationRequired || isShadowEmail)) {
      return '/account-linking'
    }

    if (role === 'client') {
      return getPendingReferralPath() ?? '/dashboard'
    }

    if (role === 'fournisseur') {
      return '/merchant'
    }

    if (role === 'admin' || role === 'super_admin') {
      return '/admin'
    }

    if (role === 'institution') {
      return '/institution'
    }

    return '/auth'
  }, [ready, role, user?.email, user?.user_metadata])

  useEffect(() => {
    hydrateCurrentUser()
      .catch(() => null)
      .finally(() => setReady(true))
  }, [hydrateCurrentUser])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  return <Navigate to={redirectTo} replace />
}

function AdminAuthRoute() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  if (user && (role === 'admin' || role === 'super_admin')) {
    return <Navigate to="/admin" replace />
  }

  if (user && role === 'client') {
    return <Navigate to="/dashboard" replace />
  }

  if (user && role === 'fournisseur') {
    return <Navigate to="/merchant" replace />
  }

  if (user && role === 'institution') {
    return <Navigate to="/institution" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs text-zinc-400">
          Accès réservé propriétaire / admin
        </div>
        <LoginForm allowedRoles={['admin']} title="Connexion propriétaire" />
      </div>
    </div>
  )
}

// ── Outlet wrappers for children-based layouts ─────────────────────────────
function DashboardLayoutRoute() {
  return (
    <DashboardLayout activePage="">
      <Outlet />
    </DashboardLayout>
  )
}

function MerchantLayoutRoute() {
  const { merchantId, storeName } = useMerchantRouteData()

  return (
    <MerchantLayout activePage="">
      <Outlet context={{ merchantId, storeName }} />
    </MerchantLayout>
  )
}

function MerchantHomeWrapper() {
  const { merchantId, storeName, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return <MerchantHome merchantId={merchantId} storeName={storeName} />
}

function MerchantRouteLoading() {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-gray-200 bg-white">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
    </div>
  )
}

function useMerchantRouteData() {
  const { user, profile } = useAuth()
  const [merchantId, setMerchantId] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const resolveMerchantId = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setMerchantId('')
          setLoading(false)
        }
        return
      }

      setLoading(true)

      const metadataMerchantId = String(user.user_metadata?.fournisseur_id ?? '').trim()

      const { data, error } = await supabase
        .from('fournisseurs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle<{ id: string }>()

      if (!cancelled) {
        const resolvedMerchantId = !error && data?.id ? data.id : metadataMerchantId
        setMerchantId(resolvedMerchantId || '')
        setLoading(false)
      }
    }

    void resolveMerchantId()

    return () => {
      cancelled = true
    }
  }, [user?.id, user?.user_metadata])

  return {
    merchantId,
    storeName:
    (profile as unknown as Record<string, string> | null)?.['nom_commerce']?.trim() ||
    (profile as unknown as Record<string, string> | null)?.['nom']?.trim() ||
      undefined,
    loading,
  }
}

function MerchantOffersWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Offres de redemption</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Gerez vos offres consommables avec des points et les regles de redemption.</p>
      </header>
      <MerchantOffers merchantId={merchantId} />
      <MerchantRedemptionRules merchantId={merchantId} />
    </section>
  )
}

function MerchantCatalogWrapper() {
  const { loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Catalogue services et produits</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Gerez votre catalogue vendu en caisse: services, tarifs et points attribues.</p>
      </header>
      <ServiceManager />
    </section>
  )
}

function MerchantClientsWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Clients fidèles</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Retrouvez vos meilleurs clients et leur niveau d’engagement.</p>
      </header>
      <TopCustomers merchantId={merchantId} />
    </section>
  )
}

function MerchantClientDetailWrapper() {
  const { merchantId, loading } = useMerchantRouteData()
  const { clientId } = useParams<{ clientId: string }>()

  if (loading) {
    return <MerchantRouteLoading />
  }

  if (!clientId) {
    return <Navigate to="/merchant/clients" replace />
  }

  return <MerchantClientDetailPage merchantId={merchantId} clientId={clientId} />
}

function MerchantTransactionsWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Transactions</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Suivez les scans validés et les points distribués récemment.</p>
      </header>
      <MerchantTransactions merchantId={merchantId} limit={12} />
    </section>
  )
}

function MerchantPerformanceWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Performance</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Visualisez le revenu généré et vos tendances de fidélisation.</p>
      </header>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MerchantRevenueChart merchantId={merchantId} />
        <TopCustomers merchantId={merchantId} />
      </div>
    </section>
  )
}

function MerchantConsumptionWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Produits ou services consommés</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Analysez les consommations de services et de récompenses, puis exportez vos données.</p>
      </header>
      <MerchantConsumedServicesCard merchantId={merchantId} />
      <MerchantConsumedRewardsCard merchantId={merchantId} />
    </section>
  )
}

function MerchantNetworksWrapper() {
  const { merchantId, loading } = useMerchantRouteData()

  if (loading) {
    return <MerchantRouteLoading />
  }

  return (
    <section className="space-y-6">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">Réseaux</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Rejoignez et pilotez les réseaux dans lesquels votre commerce est actif.</p>
      </header>
      <MerchantNetworks merchantId={merchantId} />
    </section>
  )
}

export function Router() {
  useEventTracker()

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/login" element={<AuthRoute />} />
        <Route path="/signup" element={<AuthRoute />} />
        <Route path="/join/:referralCode" element={<ReferralJoinPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/auth/callback" element={<AuthCallbackRoute />} />
        <Route path="/auth/sumup/callback" element={<SumUpOAuthCallbackPage />} />
        <Route path="/admin/auth" element={<AdminAuthRoute />} />
        <Route path="/onboarding/*" element={<OnboardingRouter />} />

        <Route element={<ProtectedRoute allowedRole="client" />}>
          {/* ── New design: /dashboard/* ── */}
          <Route element={<DashboardLayoutRoute />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/gamification" element={<GamificationPage />} />
            <Route path="/dashboard/referral" element={<ReferralProgramPage />} />
            <Route path="/dashboard/referral/analytics" element={<ReferrerAnalyticsDashboard />} />
            <Route path="/dashboard/transfers" element={<PointTransfersPage />} />
            <Route path="/dashboard/notifications" element={<DashboardNotificationsPage />} />
            <Route path="/dashboard/networks/:id" element={<ClientNetworksPage />} />
            <Route path="/points" element={<ClientPointsPage />} />
            <Route path="/networks" element={<ClientNetworksPage />} />
            <Route path="/transactions" element={<ClientTransactionsPage />} />
            <Route path="/rewards" element={<ClientRewardsPage />} />
            <Route path="/directory" element={<MerchantDirectoryPage />} />
            <Route path="/offers" element={<OffersExplorerPage />} />
            <Route path="/challenges" element={<GamificationPage />} />
            <Route path="/history" element={<ClientHistoryPage />} />
            <Route path="/account-linking" element={<AccountLinkingPage />} />
            <Route path="/settings" element={<ClientSettingsPage />} />
            <Route path="/scan" element={<QRScannerPage />} />
          </Route>
          <Route path="/client/*" element={<Navigate to="/dashboard" replace />} />
        </Route>

        <Route element={<ProtectedRoute allowedRole="fournisseur" />}>
          {/* ── New design: /merchant/* ── */}
          <Route element={<MerchantLayoutRoute />}>
            <Route path="/merchant" element={<MerchantHomeWrapper />} />
            <Route path="/merchant/qr" element={<MerchantQrPage />} />
            <Route path="/merchant/catalog" element={<MerchantCatalogWrapper />} />
            <Route path="/merchant/offers" element={<MerchantOffersWrapper />} />
            <Route path="/merchant/clients" element={<MerchantClientsWrapper />} />
            <Route path="/merchant/clients/:clientId" element={<MerchantClientDetailWrapper />} />
            <Route path="/merchant/transactions" element={<MerchantTransactionsWrapper />} />
            <Route path="/merchant/performance" element={<MerchantPerformanceWrapper />} />
            <Route path="/merchant/consumption" element={<MerchantConsumptionWrapper />} />
            <Route path="/merchant/networks" element={<MerchantNetworksWrapper />} />
            <Route path="/merchant/settings" element={<MerchantSettingsPage />} />
            <Route path="/merchant/subscription" element={<MerchantSubscriptionPage />} />
          </Route>
          <Route path="/provider/*" element={<Navigate to="/merchant" replace />} />
        </Route>

        <Route
          element={<ProtectedRoute allowedRole="admin" unauthenticatedRedirectTo="/admin/auth" />}
        >
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/network" element={<AdminNetwork />} />
            <Route path="/admin/networks" element={<NetworksListPage />} />
            <Route path="/admin/networks/new" element={<NetworkCreatePage />} />
            <Route path="/admin/networks/:id" element={<NetworkConfigPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="institution" />}>
          <Route path="/institution" element={<InstitutionDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Suspense>
  )
}
