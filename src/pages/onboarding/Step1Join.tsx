import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

const schema = z.object({
  firstName: z.string().trim().min(2, 'Minimum 2 caractères'),
  email: z.string().trim().email('Format email invalide'),
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins 1 majuscule')
    .regex(/[0-9]/, 'Au moins 1 chiffre'),
})

type FormValues = z.infer<typeof schema>

export default function Step1Join() {
  const { goNext, setAccount } = useOnboarding()
  const { loginWithOAuth } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      email: '',
      password: '',
    },
    mode: 'onBlur',
  })

  async function handleGoogle() {
    setOauthLoading('google')
    try {
      await loginWithOAuth('google')
      // redirects to /auth/callback — no further action
    } catch {
      setOauthLoading(null)
    }
  }

  async function onSubmit(values: FormValues) {
    const email = values.email.trim().toLowerCase()
    const firstName = values.firstName.trim()

    // 1. Check email not already taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1)

    if ((existing ?? []).length > 0) {
      setError('email', { type: 'manual', message: 'Cet email est déjà utilisé. Connectez-vous.' })
      return
    }

    // 2. Create Supabase auth user
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        data: {
          role: 'client',
          nom: firstName,
          first_name: firstName,
        },
      },
    })

    if (signUpError) {
      setError('email', { type: 'manual', message: signUpError.message })
      return
    }

    // 3. Save to context and advance
    setAccount({ email, firstName })
    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-md">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Rejoindre Looyaal</h1>
        <p className="mt-1 font-body text-sm text-gray-600">
          La carte fidélité unique pour tous vos commerces préférés.
        </p>
      </header>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => {
            void handleGoogle()
          }}
          disabled={Boolean(oauthLoading)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 font-body text-sm font-semibold text-gray-700 transition hover:border-[#5B4FE8] hover:bg-[#F1EEFF] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.873h5.391a4.61 4.61 0 0 1-2 3.027v2.516h3.236c1.891-1.741 2.973-4.309 2.973-7.371z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.426l-3.236-2.516c-.895.6-2.045.955-3.382.955-2.6 0-4.8-1.755-5.582-4.118H3.073v2.591A10 10 0 0 0 12 22z" />
            <path fill="#FBBC05" d="M6.418 13.895a5.996 5.996 0 0 1 0-3.79V7.514H3.073a10 10 0 0 0 0 8.972l3.345-2.591z" />
            <path fill="#EA4335" d="M12 5.987c1.468 0 2.786.505 3.823 1.495l2.868-2.868C16.959 2.995 14.695 2 12 2a10 10 0 0 0-8.927 5.514l3.345 2.591C7.2 7.742 9.4 5.987 12 5.987z" />
          </svg>
          {oauthLoading === 'google' ? 'Connexion...' : 'Continuer avec Google'}
        </button>
      </div>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">ou avec votre email</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Prénom</span>
          <input
            type="text"
            {...register('firstName')}
            placeholder="Awa"
            className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
          />
          {errors.firstName ? <p className="mt-1 font-body text-xs text-rose-600">{errors.firstName.message}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Email</span>
          <input
            type="email"
            {...register('email')}
            placeholder="vous@exemple.com"
            className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
          />
          {errors.email ? <p className="mt-1 font-body text-xs text-rose-600">{errors.email.message}</p> : null}
        </label>

        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Mot de passe</span>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
              placeholder="Minimum 8 caractères"
              className="h-11 w-full rounded-xl border border-gray-300 px-3 pr-11 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-gray-500 hover:text-[#5B4FE8]"
              aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            >
              {showPassword ? 'Masquer' : 'Voir'}
            </button>
          </div>
          {errors.password ? <p className="mt-1 font-body text-xs text-rose-600">{errors.password.message}</p> : null}
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="h-11 w-full rounded-xl bg-[#5B4FE8] font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
        >
          {isSubmitting ? 'Création en cours...' : 'Créer mon compte →'}
        </button>
      </form>

      <p className="mt-4 text-center font-body text-sm text-gray-500">
        Déjà membre ?{' '}
        <Link to="/auth" className="font-semibold text-[#5B4FE8] hover:underline">Se connecter</Link>
      </p>
    </section>
  )
}
