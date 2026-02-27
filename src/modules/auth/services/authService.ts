import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../../shared/lib/supabaseClient'

export type UserRole = 'client' | 'fournisseur' | 'admin'

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