import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginForm } from '../modules/auth/components/LoginForm'
import { RegisterForm } from '../modules/auth/components/RegisterForm'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { MerchantNetworks } from '../components/merchant/MerchantNetworks'
import { MerchantConsumedServicesCard } from '../components/merchant/MerchantConsumedServicesCard'
import { MerchantOffers } from '../components/merchant/MerchantOffers'
import { MerchantRevenueChart } from '../components/merchant/MerchantRevenueChart'
import { MerchantTransactions } from '../components/merchant/MerchantTransactions'
import { TopCustomers } from '../components/merchant/TopCustomers'
import type { SocialRole, UserRole } from '../modules/auth/services/authService'
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
const ClientSettingsPage = lazy(() =>
  import('../pages/dashboard/ClientSettingsPage').then((module) => ({ default: module.default })),
)
const ClientPointsPage = lazy(() =>
  import('../pages/dashboard/ClientPointsPage').then((module) => ({ default: module.default })),
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
const AccountLinkingPage = lazy(() =>
  import('../pages/dashboard/AccountLinkingPage').then((module) => ({ default: module.default })),
)
const QRScannerPage = lazy(() =>
  import('../pages/QRScannerPage').then((module) => ({ default: module.default })),
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

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
    </div>
  )
}

function AuthRoute() {
  const location = useLocation()
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [selectedRole, setSelectedRole] = useState<UserRole>('client')
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
    return <Navigate to="/dashboard" replace />
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#F5F7FF] via-[#F8FAFF] to-white px-4 py-10">
      <span className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <span className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-accent-green/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2 pb-2">
          <span className="font-display text-4xl font-black text-dark">LoyalUp</span>
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              authMode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-primary'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              authMode === 'signup'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:text-primary'
            }`}
          >
            Sign up
          </button>
        </div>

        {authMode === 'signup' ? (
          <>
            <div className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setSelectedRole('client')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  selectedRole === 'client'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-primary'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('fournisseur')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  selectedRole === 'fournisseur'
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-primary'
                }`}
              >
                Fournisseur
              </button>
            </div>
            <RegisterForm role={selectedRole} />
          </>
        ) : (
          <LoginForm />
        )}
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
      return '/dashboard'
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
        <h1 className="font-display text-3xl font-extrabold text-dark">Mes offres</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Gérez vos récompenses, points requis et réseaux associés.</p>
      </header>
      <MerchantOffers merchantId={merchantId} />
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
        <p className="mt-2 font-body text-sm text-gray-600">Analysez les prestations les plus consommées, les clients associés et exportez vos données.</p>
      </header>
      <MerchantConsumedServicesCard merchantId={merchantId} />
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
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="/auth/callback" element={<AuthCallbackRoute />} />
        <Route path="/admin/auth" element={<AdminAuthRoute />} />
        <Route path="/onboarding/*" element={<OnboardingRouter />} />

        <Route element={<ProtectedRoute allowedRole="client" />}>
          {/* ── New design: /dashboard/* ── */}
          <Route element={<DashboardLayoutRoute />}>
            <Route path="/dashboard" element={<DashboardHome />} />
            <Route path="/dashboard/gamification" element={<GamificationPage />} />
            <Route path="/dashboard/notifications" element={<DashboardNotificationsPage />} />
            <Route path="/dashboard/networks/:id" element={<ClientNetworksPage />} />
            <Route path="/points" element={<ClientPointsPage />} />
            <Route path="/networks" element={<ClientNetworksPage />} />
            <Route path="/transactions" element={<ClientTransactionsPage />} />
            <Route path="/rewards" element={<ClientRewardsPage />} />
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
