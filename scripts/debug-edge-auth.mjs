import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

function parseEnvValue(raw, key) {
  const match = raw.match(new RegExp(`${key}="([^"]+)"`))
  if (!match?.[1]) {
    throw new Error(`Missing ${key}`)
  }

  return match[1].replace(/\s+/g, '')
}

async function main() {
  const envRaw = execSync('npx supabase status -o env', { encoding: 'utf8' })
  const url = parseEnvValue(envRaw, 'API_URL')
  const anon = parseEnvValue(envRaw, 'ANON_KEY')

  const client = createClient(url, anon)

  const signIn = await client.auth.signInWithPassword({
    email: 'provider1@loyalup.test',
    password: 'Test1234!',
  })

  if (signIn.error || !signIn.data.session?.access_token) {
    throw signIn.error ?? new Error('Sign in failed')
  }

  const token = signIn.data.session.access_token
  console.log('tokenLen', token.length)

  const userRes = await fetch(`${url}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
  })
  console.log('auth /user', userRes.status, await userRes.text())

  const fnRes = await fetch(`${url}/functions/v1/generate-qr`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  })

  console.log('fn /generate-qr', fnRes.status, await fnRes.text())
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
