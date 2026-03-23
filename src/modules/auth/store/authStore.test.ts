import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'
import { setAuthError, setAuthSession, setAuthUser } from '../../../test/mocks/supabase'

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      profile: null,
      role: null,
      session: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    })
  })

  it('initial state: user null, loading false, role null', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.role).toBeNull()
  })

  it('login action: success → sets user, profile, role', async () => {
    const state = useAuthStore.getState()
    await state.signIn('client@looyaal.com', 'secret')

    const next = useAuthStore.getState()
    expect(next.user?.email).toBe('client@looyaal.com')
    expect(next.profile?.email).toBe('client@looyaal.com')
    expect(next.role).toBe('client')
  })

  it('login action: failure → sets error, keeps user null', async () => {
    setAuthError('Invalid credentials')

    await expect(useAuthStore.getState().signIn('x', 'y')).rejects.toThrow('Invalid credentials')

    const next = useAuthStore.getState()
    expect(next.error).toBe('Invalid credentials')
    expect(next.user).toBeNull()
  })

  it('logout action: clears all state', async () => {
    await useAuthStore.getState().signIn('client@looyaal.com', 'secret')
    await useAuthStore.getState().signOut()

    const next = useAuthStore.getState()
    expect(next.user).toBeNull()
    expect(next.profile).toBeNull()
    expect(next.role).toBeNull()
    expect(next.session).toBeNull()
  })

  it('initialize: with existing session → hydrates store', async () => {
    await useAuthStore.getState().initialize()
    const next = useAuthStore.getState()

    expect(next.user).not.toBeNull()
    expect(next.role).toBe('client')
    expect(next.isAuthenticated).toBe(true)
  })

  it('initialize: no session → keeps state empty', async () => {
    setAuthSession(null)
    setAuthUser(null)

    await useAuthStore.getState().initialize()

    const next = useAuthStore.getState()
    expect(next.user).toBeNull()
    expect(next.role).toBeNull()
    expect(next.isAuthenticated).toBe(false)
  })

  it("isClient computed: true when role is 'client'", async () => {
    await useAuthStore.getState().signIn('client@looyaal.com', 'secret')
    expect(useAuthStore.getState().role === 'client').toBe(true)
  })

  it("isProvider computed: true when role is 'fournisseur'", async () => {
    setAuthUser({
      id: 'provider-user',
      email: 'provider@looyaal.com',
      user_metadata: { role: 'fournisseur' },
      app_metadata: { role: 'fournisseur' },
      created_at: new Date().toISOString(),
    })

    await useAuthStore.getState().initialize()
    expect(useAuthStore.getState().role === 'fournisseur').toBe(true)
  })
})
