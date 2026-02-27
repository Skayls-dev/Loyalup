import { describe, expect, it } from 'vitest'
import { AuthError } from '@supabase/supabase-js'
import { getCurrentUser, signIn, signOut, signUp } from './authService'
import { createMockProfile } from '../../../test/factories'
import { setAuthError, setAuthSession, setAuthUser, setTableData } from '../../../test/mocks/supabase'

describe('authService', () => {
  it('signIn: success → returns user + profile role', async () => {
    const result = await signIn('client@loyalup.app', 'secret')

    expect(result.user?.email).toBe('client@loyalup.app')
    expect(result.role).toBe('client')
    expect(result.session).not.toBeNull()
  })

  it('signIn: wrong password → throws AuthError-like error', async () => {
    setAuthError('Invalid login credentials')

    await expect(signIn('client@loyalup.app', 'wrong')).rejects.toBeInstanceOf(Error)
  })

  it('signIn: user not found → throws AuthError-like error', async () => {
    setAuthError('User not found')

    await expect(signIn('missing@loyalup.app', 'secret')).rejects.toBeInstanceOf(Error)
  })

  it('signUp: success → creates user with correct role', async () => {
    const result = await signUp('new@loyalup.app', 'secret', 'fournisseur')

    expect(result.user?.email).toBe('new@loyalup.app')
    expect(result.role).toBe('fournisseur')
  })

  it('signUp: email already exists → throws error', async () => {
    setAuthError('User already registered')

    await expect(signUp('existing@loyalup.app', 'secret', 'client')).rejects.toThrow('User already registered')
  })

  it('signIn: resolves admin role from profile when metadata role is missing', async () => {
    setAuthUser({
      id: 'admin-user-1',
      email: 'admin1@loyalup.test',
      created_at: new Date().toISOString(),
      user_metadata: {},
      app_metadata: {},
    })

    setTableData(
      'profiles',
      [
        createMockProfile({
          id: 'admin-user-1',
          email: 'admin1@loyalup.test',
          role: 'admin',
          nom: 'Admin User',
        }),
      ],
    )

    const result = await signIn('admin1@loyalup.test', 'Test1234!')
    expect(result.role).toBe('admin')
  })

  it('signOut: success → clears session', async () => {
    await signOut()

    const result = await getCurrentUser()
    expect(result.session).toBeNull()
    expect(result.user).toBeNull()
  })

  it('getSession active session → returns session', async () => {
    const result = await getCurrentUser()
    expect(result.session).not.toBeNull()
  })

  it('getSession no session → returns null', async () => {
    setAuthSession(null)
    setAuthUser(null)

    const result = await getCurrentUser()
    expect(result.session).toBeNull()
    expect(result.user).toBeNull()
  })

  it('throws non-session auth errors from getCurrentUser', async () => {
    setAuthError(new AuthError('auth failed').message)
    await expect(getCurrentUser()).rejects.toThrow('auth failed')
  })

  it('getCurrentUser: forbidden invalid session → returns signed-out payload', async () => {
    setAuthError('Forbidden')

    const result = await getCurrentUser()

    expect(result.user).toBeNull()
    expect(result.session).toBeNull()
    expect(result.role).toBeNull()
  })
})
