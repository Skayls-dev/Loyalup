import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../../../shared/types'
import { supabase } from '../../../shared/lib/supabaseClient'

export type UserRole = 'client' | 'fournisseur' | 'admin' | 'super_admin' | 'institution'
export type SocialProvider = 'google' | 'apple'
export type SocialRole = Exclude<UserRole, 'admin' | 'super_admin' | 'institution'>

const ALLOWED_ROLES: UserRole[] = ['client', 'fournisseur']

type AuthPayload = {
  user: User | null
  profile: Profile | null
  role: UserRole | null
  session: Session | null
}

type AuthLikeError = Error & { status?: number; code?: string }

function readUserMetaString(user: User | null, key: string): string | null {
  const value = user?.user_metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readUserMetaBoolean(user: User | null, key: string): boolean | null {
  const value = user?.user_metadata?.[key]
  return typeof value === 'boolean' ? value : null
}

function resolveRoleFromMetadata(user: User | null): UserRole | null {
  const rawRole = user?.user_metadata?.role ?? user?.app_metadata?.role

  if (
    rawRole === 'client' ||
    rawRole === 'fournisseur' ||
    rawRole === 'admin' ||
    rawRole === 'super_admin' ||
    rawRole === 'institution'
  ) {
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

  if (
    data.role === 'client' ||
    data.role === 'fournisseur' ||
    data.role === 'admin' ||
    data.role === 'super_admin' ||
    data.role === 'institution'
  ) {
    return data.role
  }

  return null
}

function normalizeProfileRole(rawRole: unknown, fallbackRole: UserRole | null): UserRole | null {
  if (
    rawRole === 'client' ||
    rawRole === 'fournisseur' ||
    rawRole === 'admin' ||
    rawRole === 'super_admin' ||
    rawRole === 'institution'
  ) {
    return rawRole
  }

  return fallbackRole
}

function buildFallbackProfile(user: User | null, role: UserRole | null): Profile | null {
  if (!user || !role) {
    return null
  }

  return {
    id: user.id,
    email: user.email ?? '',
    role,
    nom: (user.user_metadata?.nom as string | undefined)?.trim() || '',
    prenom: (user.user_metadata?.prenom as string | undefined)?.trim() || null,
    nom_commerce: (user.user_metadata?.nom_commerce as string | undefined)?.trim() || null,
    ville:
      (user.user_metadata?.ville as string | undefined)?.trim() ||
      (user.user_metadata?.city as string | undefined)?.trim() ||
      null,
    city:
      (user.user_metadata?.city as string | undefined)?.trim() ||
      (user.user_metadata?.ville as string | undefined)?.trim() ||
      null,
    telephone: (user.user_metadata?.telephone as string | undefined)?.trim() || null,
    avatar_id: (user.user_metadata?.avatar_id as string | undefined)?.trim() || null,
    country: (user.user_metadata?.country as string | undefined)?.trim() || null,
    language: (user.user_metadata?.language as string | undefined)?.trim() || null,
    onboarding_completed: null,
    onboarding_complete: null,
    created_at: user.created_at ?? new Date().toISOString(),
  }
}

async function resolveUserProfile(user: User | null, role: UserRole | null): Promise<Profile | null> {
  if (!user?.id) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, nom, created_at')
    .eq('id', user.id)
    .maybeSingle<Record<string, unknown>>()

  if (error || !data) {
    return buildFallbackProfile(user, role)
  }

  const resolvedRole = normalizeProfileRole(data.role, role)

  if (!resolvedRole) {
    return buildFallbackProfile(user, role)
  }

  return {
    id: String(data.id ?? user.id),
    email: String(data.email ?? user.email ?? ''),
    role: resolvedRole,
    nom: String(data.nom ?? user.user_metadata?.nom ?? ''),
    prenom: readUserMetaString(user, 'prenom'),
    nom_commerce: readUserMetaString(user, 'nom_commerce'),
    ville: readUserMetaString(user, 'ville') ?? readUserMetaString(user, 'city'),
    city: readUserMetaString(user, 'city') ?? readUserMetaString(user, 'ville'),
    telephone: readUserMetaString(user, 'telephone'),
    avatar_id: readUserMetaString(user, 'avatar_id'),
    country: readUserMetaString(user, 'country'),
    language: readUserMetaString(user, 'language'),
    onboarding_completed: readUserMetaBoolean(user, 'onboarding_completed'),
    onboarding_complete: readUserMetaBoolean(user, 'onboarding_complete'),
    created_at: String(data.created_at ?? user.created_at ?? new Date().toISOString()),
  }
}

async function ensureProfileRow(user: User | null, role: UserRole | null, nom?: string): Promise<void> {
  if (!user?.id || !role) {
    return
  }

  const normalizedName = nom?.trim() || (user.user_metadata?.nom as string | undefined)?.trim() || ''

  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      role,
      nom: normalizedName,
    },
    { onConflict: 'id' },
  )

  if (error) {
    throw error
  }
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
  const profile = await resolveUserProfile(user, role)

  return {
    user,
    profile,
    role,
    session,
  }
}

export async function signUp(
  email: string,
  password: string,
  role: UserRole,
  nom?: string,
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
        nom: nom?.trim() || undefined,
      },
    },
  })

  if (error) {
    throw error
  }

  const user = data?.user ?? null
  const session = data?.session ?? null
  const resolvedRole = await resolveUserRole(user)

  await ensureProfileRow(user, resolvedRole ?? role, nom)
  const profile = await resolveUserProfile(user, resolvedRole ?? role)

  return {
    user,
    profile,
    role: resolvedRole ?? role,
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
        profile: null,
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
    const profile = await resolveUserProfile(user, role)

    return {
      user,
      profile,
      role,
      session,
    }
  } catch (error) {
    if (isInvalidOrExpiredSessionError(error)) {
      await supabase.auth.signOut()

      return {
        user: null,
        profile: null,
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

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      role,
      nom: normalizedName,
    },
    { onConflict: 'id' },
  )

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