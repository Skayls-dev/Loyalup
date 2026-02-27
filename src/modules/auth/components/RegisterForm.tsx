import { useState } from 'react'
import type { FormEvent } from 'react'
import { signUp, type UserRole } from '../services/authService'

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
      await signUp(email, password, role)
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
    <div className="mx-auto w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-6 text-zinc-100 shadow-[0_20px_50px_-30px_rgba(79,70,229,0.5)] backdrop-blur">
      <h2 className="text-xl font-semibold">Créer un compte</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Rôle sélectionné: <span className="font-medium text-zinc-200">{role}</span>
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="nom" className="mb-1 block text-sm text-zinc-300">
            Nom
          </label>
          <input
            id="nom"
            type="text"
            required
            value={nom}
            onChange={(event) => setNom(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="Votre nom"
          />
        </div>

        <div>
          <label htmlFor="register-email" className="mb-1 block text-sm text-zinc-300">
            Email
          </label>
          <input
            id="register-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="register-password" className="mb-1 block text-sm text-zinc-300">
            Mot de passe
          </label>
          <input
            id="register-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label htmlFor="register-confirm-password" className="mb-1 block text-sm text-zinc-300">
            Confirmer le mot de passe
          </label>
          <input
            id="register-confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/70"
            placeholder="••••••••"
          />
        </div>

        {error ? (
          <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-300">
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
