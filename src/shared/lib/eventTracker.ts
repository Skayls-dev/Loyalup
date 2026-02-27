import { config } from './env'
import type { ConsentType, EventType } from '../types'

type TrackerEvent = {
  event_type: EventType
  properties: Record<string, unknown>
  session_id: string
  page: string | null
  app_version: string
  queued_at: string
}

type ConsentCheck = (type: ConsentType) => boolean

const STORAGE_QUEUE_KEY = 'loyalup:event-queue'
const STORAGE_LAST_ACTIVITY = 'loyalup:event-last-activity'
const STORAGE_SESSION_ID = 'loyalup:event-session-id'
const MAX_BATCH_SIZE = 10
const SESSION_WINDOW_MS = 30 * 60 * 1000
const FLUSH_INTERVAL_MS = 30_000

function safeNowIso(): string {
  return new Date().toISOString()
}

function parseQueue(raw: string | null): TrackerEvent[] {
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw) as TrackerEvent[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `fallback-${Math.random().toString(36).slice(2)}`
}

class EventTracker {
  private queue: TrackerEvent[] = []
  private flushTimer: number | null = null
  private consentCheck: ConsentCheck = () => false

  constructor() {
    this.queue = parseQueue(localStorage.getItem(STORAGE_QUEUE_KEY))
    this.startTimer()

    window.addEventListener('online', () => {
      this.flush().catch(() => {
        // silent failure
      })
    })
  }

  setConsentCheck(check: ConsentCheck) {
    this.consentCheck = check
  }

  generateSessionId(): string {
    const now = Date.now()
    const lastActivityRaw = sessionStorage.getItem(STORAGE_LAST_ACTIVITY)
    const lastActivity = Number(lastActivityRaw ?? '0')
    const currentSession = sessionStorage.getItem(STORAGE_SESSION_ID)

    const shouldRefresh = !currentSession || !lastActivity || now - lastActivity > SESSION_WINDOW_MS
    const sessionId = shouldRefresh ? randomUUID() : currentSession

    if (!sessionId) {
      const fallback = randomUUID()
      sessionStorage.setItem(STORAGE_SESSION_ID, fallback)
      sessionStorage.setItem(STORAGE_LAST_ACTIVITY, String(now))
      return fallback
    }

    sessionStorage.setItem(STORAGE_SESSION_ID, sessionId)
    sessionStorage.setItem(STORAGE_LAST_ACTIVITY, String(now))

    return sessionId
  }

  track(eventType: EventType, properties: Record<string, unknown> = {}) {
    try {
      if (!this.consentCheck('analytics')) {
        return
      }

      const event: TrackerEvent = {
        event_type: eventType,
        properties,
        session_id: this.generateSessionId(),
        page: typeof window !== 'undefined' ? window.location.pathname : null,
        app_version: config.env,
        queued_at: safeNowIso(),
      }

      this.queue.push(event)
      this.persistQueue()

      if (this.queue.length >= MAX_BATCH_SIZE) {
        this.flush().catch(() => {
          // silent failure
        })
      }
    } catch {
      // silent failure
    }
  }

  trackPageView(page: string) {
    this.track('client.card_viewed', { page })
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0 || !navigator.onLine) {
      return
    }

    const batch = [...this.queue]

    try {
      await this.sendBatch(batch)
      this.queue = []
      this.persistQueue()
      return
    } catch {
      // fallback to individual sends
    }

    const remaining: TrackerEvent[] = []
    for (const event of batch) {
      try {
        await this.sendSingle(event)
      } catch {
        remaining.push(event)
      }
    }

    this.queue = remaining
    this.persistQueue()
  }

  private async sendBatch(events: TrackerEvent[]) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'app.batch',
        session_id: this.generateSessionId(),
        properties: { events },
        page: typeof window !== 'undefined' ? window.location.pathname : null,
        app_version: config.env,
      }),
      keepalive: true,
    })

    if (!response.ok) {
      throw new Error('Batch send failed')
    }
  }

  private async sendSingle(event: TrackerEvent) {
    const response = await fetch(`${config.supabaseUrl}/functions/v1/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
      keepalive: true,
    })

    if (!response.ok) {
      throw new Error('Send failed')
    }
  }

  private persistQueue() {
    localStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(this.queue))
  }

  private startTimer() {
    if (this.flushTimer !== null) {
      window.clearInterval(this.flushTimer)
    }

    this.flushTimer = window.setInterval(() => {
      this.flush().catch(() => {
        // silent failure
      })
    }, FLUSH_INTERVAL_MS)
  }
}

export const eventTracker = new EventTracker()
