import { http, HttpResponse } from 'msw'

const base = '*/functions/v1'

export const handlers = [
  http.post(`${base}/generate-qr`, async () => {
    return HttpResponse.json({
      token: 'QR-TOKEN-123',
      expires_at: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    })
  }),

  http.post(`${base}/validate-qr`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { token?: string }

    if (body.token === 'EXPIRED') {
      return HttpResponse.json({ error: 'TOKEN_EXPIRED' }, { status: 400 })
    }

    if (body.token === 'USED') {
      return HttpResponse.json({ error: 'TOKEN_USED' }, { status: 400 })
    }

    if (body.token === 'ALREADY_SCANNED') {
      return HttpResponse.json({ error: 'ALREADY_SCANNED' }, { status: 400 })
    }

    return HttpResponse.json({
      success: true,
      fournisseur_id: 'fournisseur-1',
      transaction_id: 'pending-transaction-1',
    })
  }),

  http.post(`${base}/credit-points`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      pending_transaction_id?: string
      montant?: number
    }

    if (body.pending_transaction_id === 'expired') {
      return HttpResponse.json({ error: 'TRANSACTION_EXPIRED' }, { status: 400 })
    }

    if (body.pending_transaction_id === 'wrong-provider') {
      return HttpResponse.json({ error: 'UNAUTHORIZED' }, { status: 403 })
    }

    if (!body.montant || body.montant <= 0) {
      return HttpResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
    }

    return HttpResponse.json({
      success: true,
      points_credited: Math.floor(body.montant * 10),
      new_balance: 500,
      transaction_id: 'transaction-1',
    })
  }),

  http.post(`${base}/sumup-recent-transactions`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { limit?: number }
    const limit = Math.min(50, Math.max(1, Number(body.limit ?? 5)))

    const now = Date.now()
    const items = Array.from({ length: limit }).map((_, index) => ({
      id: `sumup-${index + 1}`,
      transaction_code: `T-${index + 1}`,
      timestamp: new Date(now - index * 2 * 60 * 1000).toISOString(),
      amount: Number((12.5 + index).toFixed(2)),
      currency: 'EUR',
      status: 'SUCCESSFUL',
      payment_type: 'card',
    }))

    return HttpResponse.json({
      connected: true,
      reason: null,
      lookback_minutes: 30,
      applied_limit: limit,
      items,
      recommended: items[0] ?? null,
    })
  }),

  http.post(`${base}/unlock-reward`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { client_reward_id?: string }

    if (body.client_reward_id === 'physical-required') {
      return HttpResponse.json({ error: 'PHYSICAL_PRESENCE_REQUIRED' }, { status: 403 })
    }

    if (body.client_reward_id === 'invalid-pending') {
      return HttpResponse.json({ error: 'INVALID_PENDING_TRANSACTION' }, { status: 403 })
    }

    if (body.client_reward_id === 'digital-not-supported') {
      return HttpResponse.json({ error: 'DIGITAL_CODE_NOT_SUPPORTED' }, { status: 400 })
    }

    if (body.client_reward_id === 'insufficient') {
      return HttpResponse.json({ error: 'INSUFFICIENT_POINTS' }, { status: 400 })
    }

    return HttpResponse.json({
      success: true,
      points_deducted: 300,
      new_balance: 120,
    })
  }),

  http.post(`${base}/get-client-partner-balance`, async () => {
    return HttpResponse.json({
      success: true,
      partner_balance: 275,
      updated_at: '2026-03-13T10:00:00.000Z',
    })
  }),
]
