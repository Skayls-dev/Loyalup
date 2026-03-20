import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { SocialProvider } from '../services/authService'

type LoginRole = 'client' | 'fournisseur' | 'admin' | 'super_admin'

type LoginFormProps = {
  allowedRoles?: LoginRole[]
  title?: string
}

export function LoginForm({ allowedRoles = ['client', 'fournisseur'], title = 'Connexion' }: LoginFormProps) {
  const { login, loginWithOAuth, logout, loading, error } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<LoginRole>(allowedRoles[0] ?? 'client')
  const [localError, setLocalError] = useState<string | null>(null)
  const showRoleSelector = allowedRoles.length > 1

  const resolvedError = useMemo(() => localError ?? error, [localError, error])
  const showSocialLogin = !allowedRoles.includes('admin')

  const handleOAuthLogin = async (provider: SocialProvider) => {
    setLocalError(null)

    try {
      await loginWithOAuth(provider)
    } catch {
      return
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    try {
      const authPayload = await login(email, password)
      const effectiveRole = authPayload.role

      // super_admin is always allowed when the admin form is shown
      const adminFormAllowsSuperAdmin =
        effectiveRole === 'super_admin' && allowedRoles.includes('admin')

      if (effectiveRole && effectiveRole !== selectedRole && !adminFormAllowsSuperAdmin) {
        await logout()

        if (
          (effectiveRole === 'admin' || effectiveRole === 'super_admin') &&
          !allowedRoles.includes('admin') &&
          !allowedRoles.includes('super_admin')
        ) {
          setLocalError('Ce compte admin doit se connecter via /admin/auth.')
          return
        }

        setLocalError(
          `Ce compte est associé au rôle "${effectiveRole}" et non "${selectedRole}".`,
        )
      }
    } catch {
      return
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-card">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>

      {showRoleSelector ? (
        <div className="mt-4 grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setSelectedRole('client')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              selectedRole === 'client'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:bg-primary-light hover:text-primary'
            }`}
          >
            Client
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('fournisseur')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              selectedRole === 'fournisseur'
                ? 'bg-white text-primary shadow-sm'
                : 'text-gray-600 hover:bg-primary-light hover:text-primary'
            }`}
          >
            Fournisseur
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {showSocialLogin ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthLogin('google')}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Continuer avec Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthLogin('apple')}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Continuer avec Apple
            </button>
            <div className="relative py-1 text-center text-xs text-gray-500">
              <span className="relative z-10 bg-white px-2">ou avec email</span>
              <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-gray-200" />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-gray-700">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="••••••••"
          />
        </div>

        {resolvedError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {resolvedError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 font-medium text-white transition hover:from-indigo-600 hover:to-sky-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Connexion...
            </>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
    </div>
  )
}
