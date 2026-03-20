import { useState } from 'react'
import type { FormEvent } from 'react'
import { signInWithOAuth, signUp, type UserRole } from '../services/authService'

type RegisterFormProps = {
  role: UserRole
}

export function RegisterForm({ role }: RegisterFormProps) {
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      await signInWithOAuth(provider)
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

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-card">
      <h2 className="text-xl font-semibold text-gray-900">Créer un compte</h2>
      <p className="mt-1 text-sm text-gray-600">
        Rôle sélectionné: <span className="font-medium text-gray-800">{role}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {allowSocialSignup ? (
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthSignup('google')}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              S'inscrire avec Google
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleOAuthSignup('apple')}
              className="inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              S'inscrire avec Apple
            </button>
            <div className="relative py-1 text-center text-xs text-gray-500">
              <span className="relative z-10 bg-white px-2">ou avec email</span>
              <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-gray-200" />
            </div>
          </div>
        ) : null}

        <div>
          <label htmlFor="nom" className="mb-1 block text-sm text-gray-700">
            Nom
          </label>
          <input
            id="nom"
            type="text"
            required
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="Votre nom"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm text-gray-700">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm text-gray-700">
            Mot de passe
          </label>
          <input
            id="register-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="register-confirm-password" className="mb-1 block text-sm text-gray-700">
            Confirmer le mot de passe
          </label>
          <input
            id="register-confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
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
              Création en cours...
            </>
          ) : (
            'Créer un compte'
          )}
        </button>
      </form>
    </div>
  )
}
