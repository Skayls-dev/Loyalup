import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import type { SocialProvider } from '../../modules/auth/services/authService'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

const schema = z.object({
  firstName: z.string().trim().min(2, 'Minimum 2 caractères'),
  lastName: z.string().trim().min(2, 'Minimum 2 caractères'),
  email: z.string().trim().email('Format email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 lettre majuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre'),
})

type FormValues = z.infer<typeof schema>

export default function Step1Account() {
  const { goNext, setAccount } = useOnboarding()
  const { loginWithOAuth } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<SocialProvider | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })

  const handleOAuth = async (provider: SocialProvider) => {
    setOauthLoading(provider)

    try {
      await loginWithOAuth(provider)
      // loginWithOAuth redirects to /auth/callback — no further navigation needed.
    } catch (error) {
      setOauthLoading(null)
      setError('email', { type: 'manual', message: error instanceof Error ? error.message : 'Erreur OAuth' })
    }
  }

  const onSubmit = async (values: FormValues) => {
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', values.email)
      .limit(1)

    if (existingError) {
      setError('email', { type: 'manual', message: existingError.message })
      return
    }

    if ((existing ?? []).length > 0) {
      setError('email', { type: 'manual', message: 'Cet email est déjà utilisé' })
      return
    }

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
        },
      },
    })

    if (error) {
      if (/email/i.test(error.message)) {
        setError('email', { type: 'manual', message: error.message })
        return
      }

      if (/password/i.test(error.message)) {
        setError('password', { type: 'manual', message: error.message })
        return
      }

      setError('email', { type: 'manual', message: error.message })
      return
    }

    setAccount({
      email: values.email,
      firstName: values.firstName,
    })

    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-xl">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Créer votre compte</h1>
        <p className="mt-1 font-body text-sm text-gray-600">Commencez avec une connexion rapide ou votre email.</p>
      </header>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => {
            void handleOAuth('google')
          }}
          disabled={Boolean(oauthLoading) || isSubmitting}
          className="flex h-11 w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 font-body text-sm font-semibold text-gray-700 transition hover:border-[#5B4FE8] hover:bg-[#F1EEFF] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {oauthLoading === 'google' ? 'Connexion Google...' : 'Continuer avec Google'}
        </button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">ou avec votre email</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Prénom</span>
            <input
              type="text"
              {...register('firstName')}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
              placeholder="Awa"
            />
            {errors.firstName ? <p className="mt-1 font-body text-xs text-rose-600">{errors.firstName.message}</p> : null}
          </label>

          <label className="block">
            <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Nom</span>
            <input
              type="text"
              {...register('lastName')}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
              placeholder="Diallo"
            />
            {errors.lastName ? <p className="mt-1 font-body text-xs text-rose-600">{errors.lastName.message}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Email</span>
          <input
            type="email"
            {...register('email')}
            className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
            placeholder="vous@exemple.com"
          />
          {errors.email ? <p className="mt-1 font-body text-xs text-rose-600">{errors.email.message}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Mot de passe</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 pr-11 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
              placeholder="Minimum 8 caractères"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-gray-500 hover:text-[#5B4FE8]"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password ? <p className="mt-1 font-body text-xs text-rose-600">{errors.password.message}</p> : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting || Boolean(oauthLoading)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5B4FE8] px-4 font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
        >
          {isSubmitting ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Création en cours…
            </>
          ) : (
            'Créer mon compte'
          )}
        </button>
      </form>

      <p className="mt-4 text-center font-body text-sm text-gray-600">
        Déjà inscrit?{' '}
        <Link to="/login" className="font-semibold text-[#5B4FE8] hover:underline">
          Se connecter
        </Link>
      </p>
    </section>
  )
}
