export type LoyalUpClientOptions = {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: Record<string, unknown>
}

export class LoyalUpClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number

  constructor(options: LoyalUpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.apiKey = options.apiKey
    this.timeoutMs = options.timeoutMs ?? 10000
  }

  clients = {
    list: () => this.request('/api-v1-clients'),
    get: (id: string) => this.request(`/api-v1-clients?id=${encodeURIComponent(id)}`),
    creditPoints: (payload: Record<string, unknown>) =>
      this.request('/api-v1-clients', { method: 'POST', body: payload }),
  }

  transactions = {
    list: () => this.request('/api-v1-transactions'),
    get: (id: string) => this.request(`/api-v1-transactions?id=${encodeURIComponent(id)}`),
    create: (payload: Record<string, unknown>) =>
      this.request('/api-v1-transactions', { method: 'POST', body: payload }),
  }

  services = {
    list: () => this.request('/api-v1-services'),
    create: (payload: Record<string, unknown>) =>
      this.request('/api-v1-services', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      this.request(`/api-v1-services?id=${encodeURIComponent(id)}`, { method: 'PUT', body: payload }),
  }

  promotions = {
    list: () => this.request('/api-v1-promotions'),
    create: (payload: Record<string, unknown>) =>
      this.request('/api-v1-promotions', { method: 'POST', body: payload }),
  }

  stats = {
    get: () => this.request('/api-v1-stats'),
  }

  sandbox = {
    status: () => this.request('/api-v1-sandbox?mode=status'),
    echo: (query: Record<string, string>) => this.request('/api-v1-sandbox', { query }),
  }

  private async request(path: string, options?: RequestOptions) {
    const method = options?.method ?? 'GET'
    const url = this.makeUrl(path, options?.query)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      const payload = (await response.json()) as {
        success: boolean
        data?: unknown
        error?: { code: string; message: string }
      }

      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`)
      }

      return payload.data
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private makeUrl(path: string, query?: RequestOptions['query']) {
    const completeUrl = new URL(`${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`)

    if (!query) {
      return completeUrl.toString()
    }

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        completeUrl.searchParams.set(key, String(value))
      }
    }

    return completeUrl.toString()
  }
}

export type VerifyWebhookSignatureParams = {
  secret: string
  payload: string
  signature: string | null | undefined
  timestamp: string | null | undefined
  toleranceSeconds?: number
}

export async function verifyWebhookSignature(params: VerifyWebhookSignatureParams) {
  const toleranceSeconds = params.toleranceSeconds ?? 300

  if (!params.signature || !params.timestamp) {
    return false
  }

  if (!params.signature.startsWith('v1=')) {
    return false
  }

  const parsedTimestamp = Number(params.timestamp)
  if (!Number.isFinite(parsedTimestamp)) {
    return false
  }

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - parsedTimestamp)
  if (ageSeconds > toleranceSeconds) {
    return false
  }

  const signedPayload = `${params.timestamp}.${params.payload}`
  const expected = await hmacSha256Hex(params.secret, signedPayload)
  const actual = params.signature.replace('v1=', '')

  return timingSafeEqual(expected, actual)
}

async function hmacSha256Hex(secret: string, payload: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return mismatch === 0
}
