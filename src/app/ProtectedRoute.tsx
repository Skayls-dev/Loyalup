import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../modules/auth/hooks/useAuth'
import type { Role } from '../shared/types'

type ProtectedRouteProps = {
  allowedRole: Role
  unauthenticatedRedirectTo?: string
}

export function ProtectedRoute({ allowedRole, unauthenticatedRedirectTo = '/auth' }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-100 border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to={unauthenticatedRedirectTo} replace />
  }

  if (role !== allowedRole) {
    if (role === 'client') {
      return <Navigate to="/client" replace />
    }

    if (role === 'fournisseur') {
      return <Navigate to="/provider" replace />
    }

    if (role === 'admin') {
      return <Navigate to="/admin" replace />
    }

    return <Navigate to="/auth" replace />
  }

  return <Outlet />
}
