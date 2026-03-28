import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(fileName) {
  const envPath = path.resolve(fileName)
  if (!fs.existsSync(envPath)) return {}

  const content = fs.readFileSync(envPath, 'utf8')
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        const value = line.slice(index + 1).trim().replace(/^"|"$/g, '')
        return [key, value]
      }),
  )
}

function parseArgs(argv) {
  const args = {
    environment: 'sandbox',
    amount: undefined,
    currency: undefined,
    merchantCode: undefined,
    listLimit: 10,
    apiBase: undefined,
    historyOnly: false,
    help: false,
  }

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--help' || value === '-h') {
      args.help = true
      continue
    }

    if (value === '--history-only') {
      args.historyOnly = true
      continue
    }

    if (value === '--environment') {
      const envValue = String(argv[++index] ?? '').toLowerCase()
      if (envValue !== 'sandbox' && envValue !== 'production') {
        throw new Error(`Invalid --environment value: ${envValue}`)
      }
      args.environment = envValue
    }
    else if (value === '--amount') args.amount = Number(argv[++index])
    else if (value === '--currency') args.currency = argv[++index]
    else if (value === '--merchant-code') args.merchantCode = argv[++index]
    else if (value === '--list-limit') args.listLimit = Number(argv[++index])
    else if (value === '--api-base') args.apiBase = argv[++index]
    else throw new Error(`Unknown argument: ${value}`)
  }

  return args
}

function printHelp() {
  console.log('SumUp sandbox simulation: create checkout -> process checkout -> read transactions.history')
  console.log('')
  console.log('Usage:')
  console.log('  node scripts/sumup-sandbox-simulate.mjs [options]')
  console.log('')
  console.log('Options:')
  console.log('  --environment <mode>      sandbox | production (default: sandbox)')
  console.log('  --amount <number>         Checkout amount (default: env SUMUP_SANDBOX_AMOUNT or 12.34)')
  console.log('  --currency <code>         Currency code (default: env SUMUP_SANDBOX_CURRENCY or EUR)')
  console.log('  --merchant-code <code>    SumUp merchant code (default: env SUMUP_SANDBOX_MERCHANT_CODE)')
  console.log('  --list-limit <number>     History page size (default: 10)')
  console.log('  --api-base <url>          SumUp API base (default: env SUMUP_SANDBOX_API_BASE or https://api.sumup.com)')
  console.log('  --history-only            Skip checkout creation and only read transactions.history')
  console.log('  --help                    Show this help')
  console.log('')
  console.log('Environment files:')
  console.log('  sandbox -> .env.local')
  console.log('  production -> .env.production')
  console.log('')
  console.log('Required env (sandbox mode):')
  console.log('  SUMUP_SANDBOX_API_KEY or SUMUP_SANDBOX_ACCESS_TOKEN')
  console.log('  SUMUP_SANDBOX_MERCHANT_CODE (if not passed with --merchant-code)')
  console.log('')
  console.log('Required env (production mode):')
  console.log('  SUMUP_PRODUCTION_API_KEY or SUMUP_PRODUCTION_ACCESS_TOKEN (fallback: SUM_UP_API_KEY, SUMUP_ACCESS_TOKEN)')
  console.log('  SUMUP_PRODUCTION_MERCHANT_CODE (fallback: SUMUP_MERCHANT_CODE, or pass --merchant-code)')
}

async function sumupFetch({ apiBase, token, pathName, method = 'GET', body }) {
  const response = await fetch(`${apiBase}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${method} ${pathName} failed (${response.status}): ${JSON.stringify(payload)}`)
  }

  return payload
}

function buildProcessPayload() {
  const now = new Date()
  const expiryYear = String(now.getUTCFullYear() + 2)
  const expiryMonth = String(now.getUTCMonth() + 1).padStart(2, '0')

  return {
    payment_type: 'card',
    installments: 1,
    mandate: {
      type: 'recurrent',
      user_agent: 'LooyaalSandboxSimulator/1.0',
      user_ip: '127.0.0.1',
    },
    card: {
      type: 'VISA',
      name: 'Sandbox Shopper',
      number: '4200000000000042',
      expiry_year: expiryYear,
      expiry_month: expiryMonth,
      cvv: '123',
      zip_code: '75001',
    },
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForFinalCheckoutStatus({ apiBase, token, checkoutId, timeoutMs = 30000, intervalMs = 2000 }) {
  const deadline = Date.now() + timeoutMs
  let latest = null

  while (Date.now() <= deadline) {
    latest = await sumupFetch({
      apiBase,
      token,
      pathName: `/v0.1/checkouts/${checkoutId}`,
      method: 'GET',
    })

    const status = String(latest.status ?? '').toUpperCase()
    if (status && status !== 'PENDING') {
      return latest
    }

    await sleep(intervalMs)
  }

  return latest
}

function toFormBody(payload) {
  const params = new URLSearchParams()
  if (payload && typeof payload === 'object') {
    for (const [key, value] of Object.entries(payload)) {
      if (value == null) continue
      params.set(key, String(value))
    }
  }
  return params
}

async function runNextStep(nextStep) {
  if (!nextStep?.url || !nextStep?.method) {
    return { attempted: false, completed: false, reason: 'missing_next_step_url_or_method' }
  }

  try {
    if (nextStep.pre_action?.url && nextStep.pre_action?.method) {
      const preMethod = String(nextStep.pre_action.method).toUpperCase()
      const prePayload = toFormBody(nextStep.pre_action.payload)
      await fetch(nextStep.pre_action.url, {
        method: preMethod,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: preMethod === 'GET' ? undefined : prePayload,
      })
    }

    const method = String(nextStep.method).toUpperCase()
    const payload = toFormBody(nextStep.payload)
    await fetch(nextStep.url, {
      method,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: method === 'GET' ? undefined : payload,
      redirect: 'follow',
    })

    return { attempted: true, completed: true }
  } catch (error) {
    return {
      attempted: true,
      completed: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help) {
    printHelp()
    return
  }

  const isProduction = args.environment === 'production'
  const envFile = isProduction ? '.env.production' : '.env.local'
  const env = loadEnvFile(envFile)

  const apiBase = args.apiBase
    ?? (isProduction ? env.SUMUP_PRODUCTION_API_BASE : env.SUMUP_SANDBOX_API_BASE)
    ?? 'https://api.sumup.com'
  const token =
    (isProduction
      ? (env.SUMUP_PRODUCTION_API_KEY
        ?? env.SUMUP_PRODUCTION_ACCESS_TOKEN
        ?? env.SUM_UP_API_KEY
        ?? env.SUMUP_ACCESS_TOKEN)
      : (env.SUMUP_SANDBOX_API_KEY
        ?? env.SUMUP_SANDBOX_ACCESS_TOKEN
        ?? env.SUM_UP_API_KEY_TEST
        ?? env.SUM_UP_API_KEY))

  if (isProduction && (env.SUM_UP_API_KEY || env.SUMUP_ACCESS_TOKEN) && !env.SUMUP_PRODUCTION_API_KEY && !env.SUMUP_PRODUCTION_ACCESS_TOKEN) {
    console.warn('[WARN] Using legacy production token variable; prefer SUMUP_PRODUCTION_API_KEY or SUMUP_PRODUCTION_ACCESS_TOKEN in .env.production')
  }
  if (!isProduction && (env.SUM_UP_API_KEY_TEST || env.SUM_UP_API_KEY) && !env.SUMUP_SANDBOX_API_KEY && !env.SUMUP_SANDBOX_ACCESS_TOKEN) {
    console.warn('[WARN] Using legacy sandbox token variable; prefer SUMUP_SANDBOX_API_KEY or SUMUP_SANDBOX_ACCESS_TOKEN in .env.local')
  }
  const merchantCode = args.merchantCode
    ?? (isProduction ? env.SUMUP_PRODUCTION_MERCHANT_CODE ?? env.SUMUP_MERCHANT_CODE : env.SUMUP_SANDBOX_MERCHANT_CODE)
  const currency = (args.currency
    ?? (isProduction ? env.SUMUP_PRODUCTION_CURRENCY : env.SUMUP_SANDBOX_CURRENCY)
    ?? 'EUR').toUpperCase()
  const amount = Number(args.amount ?? (isProduction ? env.SUMUP_PRODUCTION_AMOUNT : env.SUMUP_SANDBOX_AMOUNT) ?? 12.34)
  const listLimit = Number.isFinite(args.listLimit) && args.listLimit > 0 ? args.listLimit : 10

  if (!token) {
    throw new Error(
      [
        isProduction
          ? 'Missing production SumUp token in .env.production (SUMUP_PRODUCTION_API_KEY, SUMUP_PRODUCTION_ACCESS_TOKEN, SUM_UP_API_KEY or SUMUP_ACCESS_TOKEN).'
          : 'Missing sandbox SumUp token in .env.local (SUMUP_SANDBOX_API_KEY, SUMUP_SANDBOX_ACCESS_TOKEN, SUM_UP_API_KEY_TEST or SUM_UP_API_KEY).',
        'Create an API key in SumUp Dashboard: https://me.sumup.com/settings/api-keys',
        'Important: SUMUP_CLIENT_SECRET is OAuth app secret and cannot be used as Bearer API key for this script.',
      ].join(' '),
    )
  }
  if (!merchantCode) {
    throw new Error(
      isProduction
        ? 'Missing SUMUP_PRODUCTION_MERCHANT_CODE (or SUMUP_MERCHANT_CODE) in .env.production, or pass --merchant-code'
        : 'Missing SUMUP_SANDBOX_MERCHANT_CODE in .env.local, or pass --merchant-code',
    )
  }

  if (args.historyOnly) {
    console.log(`[history] Reading transactions history (limit=${listLimit})...`)
    const history = await sumupFetch({
      apiBase,
      token,
      pathName: `/v0.1/me/transactions/history?order=descending&limit=${encodeURIComponent(String(listLimit))}`,
      method: 'GET',
    })

    const items = Array.isArray(history.items) ? history.items : []
    console.log('History read completed')
    console.log(
      JSON.stringify(
        {
          history_items: items.length,
          items,
        },
        null,
        2,
      ),
    )
    return
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be a positive number')
  }

  const checkoutReference = `looyaal-${args.environment}-${Date.now()}`
  console.log(`[1/4] Creating checkout ${checkoutReference}...`)
  const checkout = await sumupFetch({
    apiBase,
    token,
    pathName: '/v0.1/checkouts',
    method: 'POST',
    body: {
      checkout_reference: checkoutReference,
      amount,
      currency,
      merchant_code: merchantCode,
      description: 'Looyaal sandbox simulation checkout',
    },
  })

  const checkoutId = checkout.id
  if (!checkoutId) {
    throw new Error(`Checkout created but id is missing: ${JSON.stringify(checkout)}`)
  }

  console.log(`[2/4] Processing checkout ${checkoutId} with sandbox card...`)
  const processed = await sumupFetch({
    apiBase,
    token,
    pathName: `/v0.1/checkouts/${checkoutId}`,
    method: 'PUT',
    body: buildProcessPayload(),
  })

  console.log(`[3/4] Waiting checkout ${checkoutId} to settle...`)
  let checkoutAfter = await waitForFinalCheckoutStatus({ apiBase, token, checkoutId })

  let nextStepAttempt = { attempted: false, completed: false, reason: null }
  if (String(checkoutAfter?.status ?? '').toUpperCase() === 'PENDING' && (checkoutAfter?.next_step ?? processed?.next_step)) {
    console.log('[3.1/4] Checkout pending: attempting next_step automation...')
    nextStepAttempt = await runNextStep(checkoutAfter.next_step ?? processed.next_step)
    checkoutAfter = await waitForFinalCheckoutStatus({ apiBase, token, checkoutId })
  }

  console.log(`[4/4] Reading transactions history (limit=${listLimit})...`)
  const history = await sumupFetch({
    apiBase,
    token,
    pathName: `/v0.1/me/transactions/history?order=descending&limit=${encodeURIComponent(String(listLimit))}`,
    method: 'GET',
  })

  const txCode = processed.transaction_code ?? checkoutAfter.transaction_code ?? null
  const txId = processed.transaction_id ?? checkoutAfter.transaction_id ?? null
  const checkoutStatus = checkoutAfter.status ?? processed.status ?? checkout.status ?? null

  const items = Array.isArray(history.items) ? history.items : []
  const matchedTx = items.find((item) => item.transaction_code === txCode || item.id === txId) ?? null

  console.log('Sandbox simulation completed')
  console.log(
    JSON.stringify(
      {
        checkout_id: checkoutId,
        checkout_reference: checkoutReference,
        checkout_status: checkoutStatus,
        transaction_code: txCode,
        transaction_id: txId,
        history_items: items.length,
        found_in_history: Boolean(matchedTx),
        matched_history_item: matchedTx,
        next_step: checkoutAfter.next_step ?? processed.next_step ?? null,
        next_step_attempt: nextStepAttempt,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Sandbox simulation failed: ${message}`)
  process.exitCode = 1
})
