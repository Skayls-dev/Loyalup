import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabaseClient'

export type UserRole = 'client' | 'fournisseur' | 'admin'
export type SocialProvider = 'google' | 'apple'
export type SocialRole = Exclude<UserRole, 'admin'>

const ALLOWED_ROLES: UserRole[] = ['client', 'fournisseur']

type AuthPayload = {
  user: User | null
  role: UserRole | null
  session: Session | null
}

type AuthLikeError = Error & { status?: number; code?: string }

function resolveRoleFromMetadata(user: User | null): UserRole | null {
  const rawRole = user?.user_metadata?.role ?? user?.app_metadata?.role

  if (rawRole === 'client' || rawRole === 'fournisseur' || rawRole === 'admin') {
    return rawRole
  }

  return null
}

async function resolveUserRole(user: User | null): Promise<UserRole | null> {
  const metadataRole = resolveRoleFromMetadata(user)
  if (metadataRole) {
    return metadataRole
  }

  if (!user?.id) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: UserRole }>()

  if (error || !data?.role) {
    return null
  }

  if (data.role === 'client' || data.role === 'fournisseur' || data.role === 'admin') {
    return data.role
  }

  return null
}

export async function signIn(email: string, password: string): Promise<AuthPayload> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  const user = data?.user ?? null
  const session = data?.session ?? null
  const role = await resolveUserRole(user)

  return {
    user,
    role,
    session,
  }
}

export async function signUp(
  email: string,
  password: string,
  role: UserRole,
): Promise<AuthPayload> {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid role. Expected 'client' or 'fournisseur'.")
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
      },
    },
  })

  if (error) {
    throw error
  }

  const user = data?.user ?? null
  const session = data?.session ?? null
  const resolvedRole = await resolveUserRole(user)

  return {
    user,
    role: resolvedRole,
    session,
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

export async function getCurrentUser(): Promise<AuthPayload> {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    const session = sessionData?.session ?? null

    if (!session) {
      return {
        user: null,
        role: null,
        session: null,
      }
    }

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw userError
    }

    const user = userData?.user ?? null
    const role = await resolveUserRole(user)

    return {
      user,
      role,
      session,
    }
  } catch (error) {
    if (isInvalidOrExpiredSessionError(error)) {
      await supabase.auth.signOut()

      return {
        user: null,
        role: null,
        session: null,
      }
    }

    throw error
  }
}

function isInvalidOrExpiredSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const authError = error as AuthLikeError
  if (authError.status === 401 || authError.status === 403) {
    return true
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('forbidden') ||
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('refresh token not found') ||
    message.includes('session not found')
  )
}

export async function signInWithOAuth(provider: SocialProvider): Promise<void> {
  const origin = window.location.origin
  const redirectTo = `${origin}/auth/callback`

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
    },
  })

  if (error) {
    throw error
  }
}

export async function completeSocialProfile(role: SocialRole, nom: string): Promise<AuthPayload> {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error("Invalid role. Expected 'client' or 'fournisseur'.")
  }

  const normalizedName = nom.trim()
  if (!normalizedName) {
    throw new Error('Le nom est requis pour finaliser le compte.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  if (!user?.id) {
    throw new Error('Session invalide. Veuillez vous reconnecter.')
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email ?? '',
    role,
    nom: normalizedName,
  })

  if (profileError) {
    throw profileError
  }

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: {
      role,
      nom: normalizedName,
    },
  })

  if (updateUserError) {
    throw updateUserError
  }

  return getCurrentUser()
}

export async function updateCurrentUserPassword(password: string): Promise<void> {
  const normalized = password.trim()

  if (normalized.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères.')
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  const nextMetadata = {
    ...(user?.user_metadata ?? {}),
    force_password_change: false,
  }

  const { error } = await supabase.auth.updateUser({
    password: normalized,
    data: nextMetadata,
  })

  if (error) {
    throw error
  }
}