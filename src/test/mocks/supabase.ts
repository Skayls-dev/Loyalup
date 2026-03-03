import { vi } from 'vitest'
import { createMockClientPoints, createMockFournisseur, createMockProfile, createMockPromotion, createMockRewardRule, createMockService, createMockTransaction } from '../factories'

type QueryResult<T = unknown> = Promise<{ data: T; error: Error | null }>

function resolved<T>(data: T, error: Error | null = null): QueryResult<T> {
  return Promise.resolve({ data, error })
}

type RealtimeCallback = (payload: { new?: unknown; old?: unknown }) => void

type InternalState = {
  authUser: {
    id: string
    email: string
    created_at?: string
    user_metadata?: Record<string, unknown>
    app_metadata?: Record<string, unknown>
  } | null
  authSession: {
    access_token: string
    refresh_token: string
    expires_in: number
    token_type: string
    user: {
      id: string
      email: string
      user_metadata?: Record<string, unknown>
      app_metadata?: Record<string, unknown>
    }
  } | null
  authError: Error | null
  tableData: Record<string, unknown[]>
  tableErrors: Record<string, Error | null>
  functionData: Record<string, unknown>
  functionErrors: Record<string, Error | null>
  realtimeCallbacks: Record<string, RealtimeCallback[]>
}

const state: InternalState = {
  authUser: {
    id: 'user-1',
    email: 'client@loyalup.app',
    created_at: new Date().toISOString(),
    user_metadata: { role: 'client' },
    app_metadata: { role: 'client' },
  },
  authSession: {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'client@loyalup.app',
      user_metadata: { role: 'client' },
      app_metadata: { role: 'client' },
    },
  },
  authError: null,
  tableData: {
    client_points: [createMockClientPoints()],
    fournisseurs: [createMockFournisseur()],
    reward_rules: [createMockRewardRule()],
    promotions: [createMockPromotion()],
    active_promotions: [createMockPromotion()],
    services: [createMockService()],
    transactions: [createMockTransaction()],
    pending_transactions: [],
    profiles: [createMockProfile()],
  },
  tableErrors: {},
  functionData: {
    'generate-qr': {
      token: 'QR-TOKEN-123',
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    },
    'validate-qr': {
      success: true,
      fournisseur_id: 'fournisseur-1',
      transaction_id: 'pending-transaction-1',
    },
    'credit-points': {
      success: true,
      points_credited: 120,
      new_balance: 420,
      transaction_id: 'transaction-1',
    },
    'unlock-reward': {
      success: true,
      points_deducted: 300,
      new_balance: 100,
    },
  },
  functionErrors: {},
  realtimeCallbacks: {},
}

class QueryBuilder {
  private table: string

  constructor(table: string) {
    this.table = table
    ;(this as unknown as { in: ReturnType<typeof vi.fn> }).in = vi.fn(() => this)
  }

  select = vi.fn((columns?: string) => {
    void columns
    return this
  })

  insert = vi.fn((payload: unknown) => {
    const current = state.tableData[this.table] ?? []
    const rows = Array.isArray(payload) ? payload : [payload]
    state.tableData[this.table] = [...current, ...rows]
    return this
  })

  upsert = vi.fn((payload: unknown) => {
    const current = state.tableData[this.table] ?? []
    const row = (Array.isArray(payload) ? payload[0] : payload) as Record<string, unknown>
    if (!row || typeof row !== 'object') {
      return resolved(null, null)
    }

    const index = current.findIndex((item) => {
      if (!item || typeof item !== 'object') {
        return false
      }

      return (item as Record<string, unknown>).id === row.id
    })

    if (index >= 0) {
      const updated = [
        ...current.slice(0, index),
        { ...(current[index] as Record<string, unknown>), ...row },
        ...current.slice(index + 1),
      ]
      state.tableData[this.table] = updated
    } else {
      state.tableData[this.table] = [...current, row]
    }

    const error = state.tableErrors[this.table] ?? null
    return resolved(null, error)
  })

  update = vi.fn((payload: unknown) => {
    const current = state.tableData[this.table] ?? []
    if (current.length > 0 && typeof current[0] === 'object' && current[0] !== null) {
      const next = { ...(current[0] as Record<string, unknown>), ...(payload as Record<string, unknown>) }
      state.tableData[this.table] = [next, ...current.slice(1)]
    }
    return this
  })

  delete = vi.fn(() => this)
  eq = vi.fn(() => this)
  order = vi.fn(() => this)
  limit = vi.fn(() => this)
  range = vi.fn(() => this)

  maybeSingle = vi.fn(async () => {
    const error = state.tableErrors[this.table] ?? null
    const data = (state.tableData[this.table] ?? [])[0] ?? null
    return resolved(data, error)
  })

  single = vi.fn(async () => {
    const error = state.tableErrors[this.table] ?? null
    const data = (state.tableData[this.table] ?? [])[0] ?? null
    return resolved(data, error)
  })

  then(onFulfilled: (value: { data: unknown[]; error: Error | null }) => unknown) {
    const error = state.tableErrors[this.table] ?? null
    const data = state.tableData[this.table] ?? []
    return Promise.resolve({ data, error }).then(onFulfilled)
  }
}

type MockChannel = {
  name: string
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

function createChannel(name: string): MockChannel {
  const channel: MockChannel = {
    name,
    on: vi.fn((_event, _filter, callback: RealtimeCallback) => {
      const list = state.realtimeCallbacks[name] ?? []
      state.realtimeCallbacks[name] = [...list, callback]
      return channel
    }),
    subscribe: vi.fn(() => channel),
  }

  return channel
}

export const mockSupabase = {
  auth: {
    signInWithPassword: vi.fn(async () => {
      if (state.authError) {
        return { data: { user: null, session: null }, error: state.authError }
      }

      return {
        data: {
          user: state.authUser,
          session: state.authSession,
        },
        error: null,
      }
    }),

    signUp: vi.fn(async (payload: { email: string; options?: { data?: { role?: string } } }) => {
      if (state.authError) {
        return { data: { user: null, session: null }, error: state.authError }
      }

      state.authUser = {
        id: 'new-user-1',
        email: payload.email,
        created_at: new Date().toISOString(),
        user_metadata: { role: payload.options?.data?.role ?? 'client' },
        app_metadata: { role: payload.options?.data?.role ?? 'client' },
      }

      return {
        data: {
          user: state.authUser,
          session: state.authSession,
        },
        error: null,
      }
    }),

    signInWithOAuth: vi.fn(async () => {
      if (state.authError) {
        return { data: { provider: null, url: null }, error: state.authError }
      }

      return { data: { provider: 'google', url: 'https://oauth.local' }, error: null }
    }),

    updateUser: vi.fn(async (payload: { data?: Record<string, unknown> }) => {
      if (state.authError) {
        return { data: { user: null }, error: state.authError }
      }

      if (!state.authUser) {
        return { data: { user: null }, error: null }
      }

      state.authUser = {
        ...state.authUser,
        user_metadata: {
          ...(state.authUser.user_metadata ?? {}),
          ...(payload.data ?? {}),
        },
      }

      if (state.authSession?.user) {
        state.authSession = {
          ...state.authSession,
          user: {
            ...state.authSession.user,
            user_metadata: {
              ...(state.authSession.user.user_metadata ?? {}),
              ...(payload.data ?? {}),
            },
          },
        }
      }

      return { data: { user: state.authUser }, error: null }
    }),

    signOut: vi.fn(async () => {
      state.authSession = null
      state.authUser = null
      return { error: state.authError }
    }),

    getSession: vi.fn(async () => ({ data: { session: state.authSession }, error: state.authError })),
    getUser: vi.fn(async () => ({ data: { user: state.authUser }, error: state.authError })),
  },

  from: vi.fn((table: string) => new QueryBuilder(table)),

  rpc: vi.fn(async (fnName: string) => {
    const error = state.functionErrors[fnName] ?? null
    const data = state.functionData[fnName] ?? null
    return resolved(data, error)
  }),

  functions: {
    invoke: vi.fn(async (fnName: string) => {
      const error = state.functionErrors[fnName] ?? null
      const data = state.functionData[fnName] ?? null
      return { data, error }
    }),
  },

  channel: vi.fn((name: string) => createChannel(name)),

  removeChannel: vi.fn(() => Promise.resolve({ error: null })),
}

export function resetSupabaseMockState() {
  state.authError = null
  state.authUser = {
    id: 'user-1',
    email: 'client@loyalup.app',
    created_at: new Date().toISOString(),
    user_metadata: { role: 'client' },
    app_metadata: { role: 'client' },
  }
  state.authSession = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-1',
      email: 'client@loyalup.app',
      user_metadata: { role: 'client' },
      app_metadata: { role: 'client' },
    },
  }
  state.tableErrors = {}
  state.functionErrors = {}
  state.realtimeCallbacks = {}
}

export function setAuthError(message: string | null) {
  state.authError = message ? new Error(message) : null
}

export function setAuthSession(session: InternalState['authSession']) {
  state.authSession = session
}

export function setAuthUser(user: InternalState['authUser']) {
  state.authUser = user
}

export function setTableData(table: string, data: unknown[]) {
  state.tableData[table] = data
}

export function setTableError(table: string, message: string | null) {
  state.tableErrors[table] = message ? new Error(message) : null
}

export function setFunctionResult(name: string, data: unknown) {
  state.functionData[name] = data
}

export function setFunctionError(name: string, message: string | null) {
  state.functionErrors[name] = message ? new Error(message) : null
}

export function emitRealtime(name: string, payload: { new?: unknown; old?: unknown }) {
  const callbacks = state.realtimeCallbacks[name] ?? []
  callbacks.forEach((callback) => callback(payload))
}

export function emitRealtimeByPrefix(prefix: string, payload: { new?: unknown; old?: unknown }) {
  Object.entries(state.realtimeCallbacks)
    .filter(([name]) => name.startsWith(prefix))
    .forEach(([, callbacks]) => {
      callbacks.forEach((callback) => callback(payload))
    })
}

export function getRealtimeChannelNames(): string[] {
  return Object.keys(state.realtimeCallbacks)
}
