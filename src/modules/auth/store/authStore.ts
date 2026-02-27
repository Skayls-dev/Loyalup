import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { ConsentRecord, Profile } from '../../../shared/types'
import {
  getCurrentUser,
  signIn as signInService,
  signOut as signOutService,
  signUp as signUpService,
  type UserRole,
} from '../services/authService'

type AuthPayload = {
  user: User | null
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
  signUp: (email: string, password: string, role: UserRole) => Promise<AuthPayload>
  signOut: () => Promise<void>
  clearError: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown authentication error'
}

function buildProfile(user: User | null, role: UserRole | null): Profile | null {
  if (!user || !role) {
    return null
  }

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    nom: (user.user_metadata?.nom as string | undefined) ?? '',
    created_at: user.created_at ?? new Date().toISOString(),
  }
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
      const { user, role, session } = await getCurrentUser()

      set({
        user,
        profile: buildProfile(user, role),
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
      const { user, role, session } = await getCurrentUser()

      set({
        user,
        profile: buildProfile(user, role),
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, role, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null })

    try {
      const { user, role, session } = await signInService(email, password)

      set({
        user,
        profile: buildProfile(user, role),
        role,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, role, session }
    } catch (error) {
      set({ loading: false, error: getErrorMessage(error) })
      throw error
    }
  },

  signUp: async (email, password, role) => {
    set({ loading: true, error: null })

    try {
      const { user, role: resolvedRole, session } = await signUpService(email, password, role)

      set({
        user,
        profile: buildProfile(user, resolvedRole),
        role: resolvedRole,
        session,
        userConsents: [],
        isAuthenticated: Boolean(session ?? user),
        loading: false,
      })

      return { user, role: resolvedRole, session }
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