import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const user = useAuthStore((state) => state.user)
  const profile = useAuthStore((state) => state.profile)
  const role = useAuthStore((state) => state.role)
  const loading = useAuthStore((state) => state.loading)
  const error = useAuthStore((state) => state.error)
  const hydrateCurrentUser = useAuthStore((state) => state.hydrateCurrentUser)
  const login = useAuthStore((state) => state.signIn)
  const loginWithOAuth = useAuthStore((state) => state.signInWithOAuth)
  const completeSocialProfile = useAuthStore((state) => state.completeSocialProfile)
  const updatePassword = useAuthStore((state) => state.updatePassword)
  const logout = useAuthStore((state) => state.signOut)

  const isClient = role === 'client'
  const isProvider = role === 'fournisseur'

  return {
    user,
    profile,
    role,
    loading,
    error,
    hydrateCurrentUser,
    login,
    loginWithOAuth,
    completeSocialProfile,
    updatePassword,
    logout,
    isClient,
    isProvider,
  }
}
