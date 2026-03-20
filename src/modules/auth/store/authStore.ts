import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { ConsentRecord, Profile } from '../../../shared/types'
import {
  completeSocialProfile as completeSocialProfileService,
  getCurrentUser,
  signIn as signInService,
  signInWithOAuth as signInWithOAuthService,
  signOut as signOutService,
  type SocialRole,
  signUp as signUpService,
  type SocialProvider,
  updateCurrentUserPassword as updateCurrentUserPasswordService,
  type UserRole,
} from '../services/authService'

type AuthPayload = {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  session: Session | null
}

type AuthState = {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  session: Session | null
  userConsents: ConsentRecord[]
  isAuthenticated: boolean
  loading: boolean
  error: string | null
  setUserConsents: (consents: ConsentRecord[]) => void
  initialize: () => Promise<void>
  hydrateCurrentUser: () => Promise<AuthPayload>
  signIn: (email: string, password: string) => Promise<AuthPayload>
  signInWithOAuth: (provider: SocialProvider) => Promise<void>
  completeSocialProfile: (role: SocialRole, nom: string) => Promise<AuthPayload>
  signUp: (email: string, password: string, role: UserRole) => Promise<AuthPayload>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown authentication error'
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  role: null,
  session: null,
  userConsents: [],
  isAuthenticated: false,
  loading: false,
  error: null,
  setUserConsents: (consents) => set({ userConsents: consents }),

  initialize: async () => {
    set({ loading: true, error: null })

    try {
      const { user, profile, role, session } = await getCurrentUser()

      set({
        user,
        profile,
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
    }
  },

  hydrateCurrentUser: async () => {
    set({ loading: true, error: null })

    try {
      const { user, profile, role, session } = await getCurrentUser()

      set({
        user,
        profile,
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, profile, role, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })

    try {
      const { user, profile, role, session } = await signInService(email, password)

      set({
        user,
        profile,
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, profile, role, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signInWithOAuth: async (provider) => {
    set({ loading: true, error: null })

    try {
      await signInWithOAuthService(provider)
      set({ loading: false })
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  completeSocialProfile: async (role, nom) => {
    set({ loading: true, error: null })

    try {
      const { user, profile, role: resolvedRole, session } = await completeSocialProfileService(role, nom)

      set({
        user,
        profile,
        role: resolvedRole,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, profile, role: resolvedRole, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signUp: async (email, password, role) => {
    set({ loading: true, error: null })

    try {
      const { user, profile, role: resolvedRole, session } = await signUpService(email, password, role)

      set({
        user,
        profile,
        role: resolvedRole,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, profile, role: resolvedRole, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  updatePassword: async (password) => {
    set({ loading: true, error: null })

    try {
      await updateCurrentUserPasswordService(password)
      const { user, profile, role, session } = await getCurrentUser()

      set({
        user,
        profile,
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signOut: async () => {
    set({ loading: true, error: null })

    try {
      await signOutService()
      set({
        user: null,
        profile: null,
        role: null,
        session: null,
        userConsents: [],
        isAuthenticated: false,
        loading: false,
      })
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  clearError: () => set({ error: null }),
}))