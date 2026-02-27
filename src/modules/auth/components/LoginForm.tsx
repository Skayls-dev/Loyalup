import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'

type LoginRole = 'client' | 'fournisseur' | 'admin'

type LoginFormProps = {
  allowedRoles?: LoginRole[]
  title?: string
}

export function LoginForm({ allowedRoles = ['client', 'fournisseur'], title = 'Connexion' }: LoginFormProps) {
  const { login, logout, loading, error } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<LoginRole>(allowedRoles[0] ?? 'client')
  const [localError, setLocalError] = useState<string | null>(null)
  const showRoleSelector = allowedRoles.length > 1

  const resolvedError = useMemo(() => localError ?? error, [localError, error])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)

    try {
      const authPayload = await login(email, password)

      if (authPayload.role && authPayload.role !== selectedRole) {
        await logout()

        if (authPayload.role === 'admin' && !allowedRoles.includes('admin')) {
          setLocalError('Ce compte admin doit se connecter via /admin/auth.')
          return
        }

        setLocalError(
          `Ce compte est associé au rôle "${authPayload.role}" et non "${selectedRole}".`,
        )
      }
    } catch {
      return
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 text-zinc-100 shadow-[0_20px_50px_-30px_rgba(79,70,229,0.5)] backdrop-blur">
      <h2 className="text-xl font-semibold">{title}</h2>

      {showRoleSelector ? (
        <div className="mt-4 grid grid-cols-2 rounded-xl border border-zinc-700 bg-zinc-900/80 p-1">
          <button
            type="button"
            onClick={() => setSelectedRole('client')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              selectedRole === 'client'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            Client
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('fournisseur')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              selectedRole === 'fournisseur'
                ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            Fournisseur
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-zinc-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-zinc-300">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="••••••••"
          />
        </div>

        {resolvedError ? (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
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
