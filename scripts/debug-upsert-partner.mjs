import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function readEnvValue(filePath, key) {
  const raw = readFileSync(filePath, 'utf8')
  const line = raw.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`) && !entry.trim().startsWith('#'))
  if (!line) throw new Error(`Missing ${key} in ${filePath}`)
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, '')
}

async function invoke(supabase, body) {
  const { data, error } = await supabase.functions.invoke('admin-console', {
    method: 'POST',
    body,
  })

  return {
    data,
    error: error?.message ?? null,
  }
}

async function main() {
  const url = readEnvValue('.env.production', 'VITE_SUPABASE_URL')
  const anon = readEnvValue('.env.production', 'VITE_SUPABASE_ANON_KEY')

  const supabase = createClient(url, anon)

  const auth = await supabase.auth.signInWithPassword({
    email: 'superadmin@loyalup.test',
    password: 'SuperAdmin123!',
  })

  if (auth.error) throw auth.error

  const usersResult = await invoke(supabase, { action: 'LIST_USERS', page: 1, limit: 10, search: 'superadmin' })
  console.log('LIST_USERS error:', usersResult.error)
  console.log('LIST_USERS data:', JSON.stringify(usersResult.data))

  const upsertResult = await invoke(supabase, {
    action: 'UPSERT_PARTNER',
    code: 'KUVAAGO',
    name: 'Kuvaago',
    status: 'sandbox_active',
  })

  console.log('UPSERT_PARTNER error:', upsertResult.error)
  console.log('UPSERT_PARTNER data:', JSON.stringify(upsertResult.data))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
