import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginForm } from '../modules/auth/components/LoginForm'
import { RegisterForm } from '../modules/auth/components/RegisterForm'
import { useAuth } from '../modules/auth/hooks/useAuth'
import type { UserRole } from '../modules/auth/services/authService'
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
  const { user, role, loading } = useAuth()

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

        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Suspense>
  )
}
