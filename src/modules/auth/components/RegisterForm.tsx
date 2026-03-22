import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { signUp, type UserRole } from '../services/authService'

function GoogleSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function AppleSvg() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

type RegisterFormProps = {
  role: UserRole
  /** When true renders without the outer card wrapper — for embedding in a styled panel */
  bare?: boolean
}

export function RegisterForm({ role, bare = false }: RegisterFormProps) {
  const { loginWithOAuth } = useAuth()
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const allowSocialSignup = role === 'client'

  const handleOAuthSignup = async (provider: 'google' | 'apple') => {
    setError(null)
    setSuccessMessage(null)
    setLoading(true)

    try {
      await loginWithOAuth(provider)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Connexion sociale impossible.'
      setError(message)
      setLoading(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    try {
      await signUp(email, password, role, nom)
      setSuccessMessage('Compte créé avec succès. Vérifie votre email pour confirmer le compte.')
      setNom('')
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Inscription impossible.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const formContent = (
    <>
      {allowSocialSignup ? (
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthSignup('google')}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleSvg />
            S'inscrire avec Google
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuthSignup('apple')}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AppleSvg />
            S'inscrire avec Apple
          </button>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-medium text-zinc-400">ou avec votre email</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="nom" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Nom
          </label>
          <input
            id="nom"
            type="text"
            required
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            placeholder="Votre nom"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            placeholder="vous@exemple.com"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 pr-11 text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3.5 flex items-center text-zinc-400 hover:text-zinc-600"
              tabIndex={-1}
              aria-label={showPassword ? 'Masquer' : 'Afficher'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="register-confirm-password" className="mb-1.5 block text-sm font-medium text-zinc-700">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <input
              id="register-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 pr-11 text-zinc-900 shadow-sm placeholder:text-zinc-400 transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-3.5 flex items-center text-zinc-400 hover:text-zinc-600"
              tabIndex={-1}
              aria-label={showConfirm ? 'Masquer' : 'Afficher'}
            >
              {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 font-semibold text-white shadow-md shadow-violet-500/20 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Création en cours...
            </>
          ) : (
            'Créer un compte'
          )}
        </button>
      </form>
    </>
  )

  if (bare) {
    return formContent
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-xl">
      <h2 className="mb-1 text-xl font-semibold text-zinc-900">Créer un compte</h2>
      <p className="mb-5 text-sm text-zinc-500">
        Rôle sélectionné: <span className="font-medium text-zinc-700">{role}</span>
      </p>
      {formContent}
    </div>
  )
}
