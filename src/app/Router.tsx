import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginForm } from '../modules/auth/components/LoginForm'
import { RegisterForm } from '../modules/auth/components/RegisterForm'
import { useAuth } from '../modules/auth/hooks/useAuth'
import type { SocialRole, UserRole } from '../modules/auth/services/authService'
import { useEventTracker } from '../shared/hooks/useEventTracker'

const ClientLayout = lazy(() =>
  import('../views/client/ClientLayout').then((module) => ({ default: module.ClientLayout })),
)
const ClientHome = lazy(() =>
  import('../views/client/ClientHome').then((module) => ({ default: module.ClientHome })),
)
const ClientScan = lazy(() =>
  import('../views/client/ClientScan').then((module) => ({ default: module.ClientScan })),
)
const ClientHistory = lazy(() =>
  import('../views/client/ClientHistory').then((module) => ({ default: module.ClientHistory })),
)
const ClientPromotions = lazy(() =>
  import('../views/client/ClientPromotions').then((module) => ({ default: module.ClientPromotions })),
)
const ClientProfile = lazy(() =>
  import('../views/client/ClientProfile').then((module) => ({ default: module.ClientProfile })),
)
const ClientGamification = lazy(() =>
  import('../views/client/ClientGamification').then((module) => ({ default: module.ClientGamification })),
)
const ProviderLayout = lazy(() =>
  import('../views/provider/ProviderLayout').then((module) => ({ default: module.ProviderLayout })),
)
const ProviderDashboard = lazy(() =>
  import('../views/provider/ProviderDashboard').then((module) => ({ default: module.ProviderDashboard })),
)
const ProviderValidate = lazy(() =>
  import('../views/provider/ProviderValidate').then((module) => ({ default: module.ProviderValidate })),
)
const ProviderNetwork = lazy(() =>
  import('../views/provider/ProviderNetwork').then((module) => ({ default: module.ProviderNetwork })),
)
const AdminDashboard = lazy(() =>
  import('../views/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })),
)
const AdminNetwork = lazy(() =>
  import('../views/admin/AdminNetwork').then((module) => ({ default: module.AdminNetwork })),
)
const AdminLayout = lazy(() =>
  import('../views/admin/AdminLayout').then((module) => ({ default: module.AdminLayout })),
)
const InstitutionDashboard = lazy(() =>
  import('../modules/institutions/components/InstitutionDashboard').then((module) => ({ default: module.InstitutionDashboard })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
    </div>
  )
}

function AuthRoute() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [selectedRole, setSelectedRole] = useState<UserRole>('client')
  const [socialRole, setSocialRole] = useState<SocialRole>('client')
  const [socialName, setSocialName] = useState('')
  const [socialError, setSocialError] = useState<string | null>(null)
  const { user, role, loading, completeSocialProfile } = useAuth()

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
    return <Navigate to="/client" replace />
  }

  if (user && role === 'fournisseur') {
    return <Navigate to="/provider" replace />
  }

  if (user && role === 'admin') {
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
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 text-zinc-100 shadow-[0_20px_50px_-30px_rgba(79,70,229,0.5)] backdrop-blur">
          <h2 className="text-xl font-semibold">Finaliser votre compte</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Choisissez votre rôle et votre nom pour terminer la connexion sociale.
          </p>

          <div className="mt-4 grid grid-cols-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-1">
            <button
              type="button"
              onClick={() => setSocialRole('client')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                socialRole === 'client'
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              Client
            </button>
            <button
              type="button"
              onClick={() => setSocialRole('fournisseur')}
              className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                socialRole === 'fournisseur'
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              Fournisseur
            </button>
          </div>

          <div className="mt-4">
            <label htmlFor="social-name" className="mb-1 block text-sm text-zinc-300">
              Nom
            </label>
            <input
              id="social-name"
              type="text"
              required
              value={socialName}
              onChange={(event) => setSocialName(event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
              placeholder="Votre nom"
            />
          </div>

          {socialError ? (
            <p className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="grid grid-cols-2 rounded-lg bg-zinc-800 p-1">
          <button
            type="button"
            onClick={() => setAuthMode('login')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              authMode === 'login' ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-300 hover:text-zinc-100'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('signup')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              authMode === 'signup'
                ? 'bg-zinc-200 text-zinc-900'
                : 'text-zinc-300 hover:text-zinc-100'
            }`}
          >
            Sign up
          </button>
        </div>

        {authMode === 'signup' ? (
          <>
            <div className="grid grid-cols-2 rounded-lg bg-zinc-800 p-1">
              <button
                type="button"
                onClick={() => setSelectedRole('client')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  selectedRole === 'client'
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-300 hover:text-zinc-100'
                }`}
              >
                Client
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('fournisseur')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  selectedRole === 'fournisseur'
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-300 hover:text-zinc-100'
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
  const { hydrateCurrentUser } = useAuth()
  const [ready, setReady] = useState(false)

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

  return <Navigate to="/auth" replace />
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

  if (user && role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (user && role === 'client') {
    return <Navigate to="/client" replace />
  }

  if (user && role === 'fournisseur') {
    return <Navigate to="/provider" replace />
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

export function Router() {
  useEventTracker()

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthRoute />} />
        <Route path="/auth/callback" element={<AuthCallbackRoute />} />
        <Route path="/admin/auth" element={<AdminAuthRoute />} />

        <Route element={<ProtectedRoute allowedRole="client" />}>
          <Route element={<ClientLayout />}>
            <Route path="/client" element={<ClientHome />} />
            <Route path="/client/scan" element={<ClientScan />} />
            <Route path="/client/history" element={<ClientHistory />} />
            <Route path="/client/promotions" element={<ClientPromotions />} />
            <Route path="/client/profile" element={<ClientProfile />} />
            <Route path="/client/gamification" element={<ClientGamification />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRole="fournisseur" />}>
          <Route element={<ProviderLayout />}>
            <Route path="/provider" element={<ProviderDashboard />} />
            <Route path="/provider/validate" element={<ProviderValidate />} />
            <Route path="/provider/network" element={<ProviderNetwork />} />
          </Route>
        </Route>

        <Route
          element={<ProtectedRoute allowedRole="admin" unauthenticatedRedirectTo="/admin/auth" />}
        >
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/network" element={<AdminNetwork />} />
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
