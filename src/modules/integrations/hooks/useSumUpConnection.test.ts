import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setTableData, setTableError, setAuthSession } from '../../../test/mocks/supabase'
import { mockSupabase } from '../../../test/mocks/supabase'
import { useSumUpConnection } from './useSumUpConnection'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a fake JWT token with a given exp (seconds since epoch). */
function makeFakeJwt(expOffsetSec = 7200): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSec }))
  return `header.${payload}.signature`
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { wrapper, queryClient }
}

const ACTIVE_ROW = {
  id: 'uuid-1',
  status: 'active',
  sumup_merchant_code: 'MC123',
  sumup_merchant_name: 'Test Shop',
  created_at: '2026-01-01T00:00:00.000Z',
  expires_at: new Date(Date.now() + 3_600_000).toISOString(),
}

const FOURNISSEUR_ID = 'fournisseur-test-id'

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  setTableData('provider_integrations', [ACTIVE_ROW])
  setAuthSession({
    access_token: makeFakeJwt(),
    refresh_token: 'refresh-token',
    expires_in: 7200,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'merchant@looyaal.com',
      user_metadata: { role: 'fournisseur' },
      app_metadata: { role: 'fournisseur' },
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('useSumUpConnection', () => {
  it('connectionStatus est "connected" quand status=active et expires_at dans le futur', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.connectionStatus).toBe('connected')
  })

  it('connectionStatus est "expired" quand expires_at est dans le passé', async () => {
    setTableData('provider_integrations', [
      { ...ACTIVE_ROW, expires_at: new Date(Date.now() - 1000).toISOString() },
    ])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.connectionStatus).toBe('expired')
  })

  it('connectionStatus est "disconnected" quand la base retourne null', async () => {
    setTableData('provider_integrations', [])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.connectionStatus).toBe('disconnected')
  })

  it('merchantName et merchantCode sont extraits correctement', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.merchantName).toBe('Test Shop')
    expect(result.current.merchantCode).toBe('MC123')
  })

  it('isLoading est true pendant le fetch initial', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    // Checked synchronously before query resolves
    expect(result.current.isLoading).toBe(true)
  })

  it('connect() appelle sumup-oauth-init et redirige vers authorize_url', async () => {
    const AUTHORIZE_URL = 'https://api.sumup.com/authorize?client_id=test&state=abc'

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ authorize_url: AUTHORIZE_URL }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    // Stub window.location as a plain writable object (JSDOM's href is non-configurable)
    const mockLocation = { href: '' }
    vi.stubGlobal('location', mockLocation)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await result.current.connect()
    })

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, options] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/functions/v1/sumup-oauth-init')
    expect((options.headers as Record<string, string>)['Authorization']).toMatch(/^Bearer /)
    expect(mockLocation.href).toBe(AUTHORIZE_URL)
  })

  it('disconnect() met à jour status="revoked" et invalide le queryCache', async () => {
    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    // Capture the QueryBuilder returned by from() so we can inspect its update spy
    const capturedBuilders: Array<{ update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> }> = []
    vi.spyOn(mockSupabase, 'from').mockImplementation((table: string) => {
      // Use the real mock implementation (returns a QueryBuilder)
      vi.mocked(mockSupabase.from).mockRestore()
      const builder = mockSupabase.from(table)
      if (table === 'provider_integrations') {
        capturedBuilders.push(builder as unknown as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> })
      }
      // Re-spy for subsequent calls
      vi.spyOn(mockSupabase, 'from').mockImplementation((t: string) => {
        vi.mocked(mockSupabase.from).mockRestore()
        const b = mockSupabase.from(t)
        if (t === 'provider_integrations') {
          capturedBuilders.push(b as unknown as { update: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn> })
        }
        return b
      })
      return builder
    })

    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.connectionStatus).toBe('connected')

    await act(async () => {
      await result.current.disconnect()
    })

    // The last captured builder for provider_integrations is the one used by disconnect()
    const disconnectBuilder = capturedBuilders.at(-1)
    expect(disconnectBuilder?.update).toHaveBeenCalledWith({ status: 'revoked' })

    // Verify query cache was invalidated
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['sumup-connection', FOURNISSEUR_ID] }),
    )
  })

  it('connectionStatus est "disconnected" quand status="revoked"', async () => {
    setTableData('provider_integrations', [{ ...ACTIVE_ROW, status: 'revoked' }])

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.connectionStatus).toBe('disconnected')
  })

  it('la DB retourne une erreur → isLoading se résout sans planter', async () => {
    setTableError('provider_integrations', 'Connexion base de données échouée')

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSumUpConnection(FOURNISSEUR_ID), { wrapper })

    // With retry: false the query should fail fast
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    // On error the query throws, React Query sets data to undefined → null → disconnected
    expect(result.current.connectionStatus).toBeDefined()
  })
})
