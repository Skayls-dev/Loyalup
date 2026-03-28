import { useEffect } from 'react'
import { config } from '../shared/lib/env'

export default function SumUpOAuthCallbackPage() {
  useEffect(() => {
    const current = new URL(window.location.href)
    const upstream = new URL(`${config.supabaseUrl}/functions/v1/sumup-oauth-callback`)

    // Forward every query parameter (code, state, merchant_code, error, ...)
    current.searchParams.forEach((value, key) => {
      upstream.searchParams.append(key, value)
    })

    window.location.replace(upstream.toString())
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <p className="text-sm text-gray-600">Connexion SumUp en cours…</p>
    </div>
  )
}
