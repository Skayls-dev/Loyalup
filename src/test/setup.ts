import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from './mocks/handlers'
import { mockSupabase, resetSupabaseMockState } from './mocks/supabase'

vi.mock('../shared/lib/supabaseClient', () => ({
  supabase: mockSupabase,
}))

const startMock = vi.fn(async () => undefined)
const stopMock = vi.fn(async () => undefined)
const clearMock = vi.fn(() => undefined)

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(function MockHtml5Qrcode() {
    return {
      start: startMock,
      stop: stopMock,
      clear: clearMock,
      isScanning: false,
    }
  }),
}))

export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

afterEach(() => {
  server.resetHandlers()
  vi.clearAllMocks()
  resetSupabaseMockState()
})

afterAll(() => {
  server.close()
})
