import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const role = useAuthStore((state) => state.role)
  const loading = useAuthStore((state) => state.loading)
  const error = useAuthStore((state) => state.error)
  const login = useAuthStore((state) => state.signIn)
  const logout = useAuthStore((state) => state.signOut)

  const isClient = role === 'client'
  const isProvider = role === 'fournisseur'

  return {
    user,
    profile,
    role,
    loading,
    error,
    login,
    logout,
    isClient,
    isProvider,
  }
}
