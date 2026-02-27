type AppEnv = 'development' | 'staging' | 'production'

type EnvConfig = {
  supabaseUrl: string
  supabaseAnonKey: string
  env: AppEnv
  isDevelopment: boolean
  isStaging: boolean
  isProduction: boolean
}

function readEnvVar<K extends 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_ENV'>(key: K): string {
  const value = import.meta.env[key]

  if (!value || value.trim().length === 0) {
    throw new Error(`[env] Missing required environment variable: ${key}`)
  }

  return value
}

function parseEnv(value: string): AppEnv {
  if (value === 'development' || value === 'staging' || value === 'production') {
    return value
  }

  throw new Error(`[env] Invalid VITE_ENV value "${value}". Expected development | staging | production`)
}

function parseUrl(value: string): string {
  try {
    const parsed = new URL(value)
    return parsed.toString().replace(/\/$/, '')
  } catch {
    throw new Error('[env] VITE_SUPABASE_URL must be a valid URL')
  }
}

const env = parseEnv(readEnvVar('VITE_ENV'))

export const config: EnvConfig = {
  supabaseUrl: parseUrl(readEnvVar('VITE_SUPABASE_URL')),
  supabaseAnonKey: readEnvVar('VITE_SUPABASE_ANON_KEY'),
  env,
  isDevelopment: env === 'development',
  isStaging: env === 'staging',
  isProduction: env === 'production',
}
