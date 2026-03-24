import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

const avatars = [
  { id: 'lion', emoji: '🦁', label: 'Lion', gradient: 'linear-gradient(135deg, #FFE3A3, #FFB86B)' },
  { id: 'leopard', emoji: '🐆', label: 'Léopard', gradient: 'linear-gradient(135deg, #FFD6C2, #FF9A8B)' },
  { id: 'eagle', emoji: '🦅', label: 'Aigle', gradient: 'linear-gradient(135deg, #CBE8FF, #8EC5FC)' },
  { id: 'flower', emoji: '🌺', label: 'Fleur', gradient: 'linear-gradient(135deg, #F8D7FF, #C9A9FF)' },
] as const

const countries = ['Belgique', 'France', 'Pays-Bas', 'Luxembourg'] as const
const languages = ['Français', 'English', 'Nederlands'] as const

const schema = z.object({
  city: z.string().trim().min(1, 'Ville requise'),
  country: z.enum(countries),
  language: z.enum(languages),
})

type FormValues = z.infer<typeof schema>

export default function Step2Profile() {
  const { goNext, goPrev } = useOnboarding()
  const [selectedAvatar, setSelectedAvatar] = useState<(typeof avatars)[number]['id']>(avatars[0].id)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      city: '',
      country: 'Belgique',
      language: 'Français',
    },
    mode: 'onBlur',
  })

  const selectedId = useMemo(
    () => avatars.some((a) => a.id === selectedAvatar) ? selectedAvatar : avatars[0].id,
    [selectedAvatar],
  )

  const onSubmit = async (values: FormValues) => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('city', { type: 'manual', message: authError?.message ?? 'Utilisateur introuvable' })
      return
    }

    const metadata = authData.user.user_metadata ?? {}

    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        ...metadata,
        avatar_id: selectedId,
        city: values.city,
        country: values.country,
        language: values.language,
      },
    })

    if (updateError) {
      setError('city', { type: 'manual', message: updateError.message })
      return
    }

    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Compléter votre profil</h1>
        <p className="mt-1 font-body text-sm text-gray-600">Choisissez un avatar et vos préférences de localisation.</p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {avatars.map((avatar) => {
          const selected = selectedId === avatar.id

          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => setSelectedAvatar(avatar.id)}
              className={`rounded-xl border-2 p-3 text-center transition ${
                selected ? 'border-[#5B4FE8] bg-[#F1EEFF]' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span
                className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{ background: avatar.gradient }}
                aria-hidden="true"
              >
                {avatar.emoji}
              </span>
              <p className="mt-2 font-body text-sm font-semibold text-dark">{avatar.label}</p>
            </button>
          )
        })}
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Ville</span>
            <input
              type="text"
              {...register('city')}
              className="h-11 w-full rounded-xl border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
              placeholder="Bruxelles"
            />
            {errors.city ? <p className="mt-1 font-body text-xs text-rose-600">{errors.city.message}</p> : null}
          </label>

          <label className="block">
            <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Pays</span>
            <select
              {...register('country')}
              className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
            >
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
            {errors.country ? <p className="mt-1 font-body text-xs text-rose-600">{errors.country.message}</p> : null}
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Langue préférée</span>
          <select
            {...register('language')}
            className="h-11 w-full rounded-xl border border-gray-300 bg-white px-3 font-body text-sm text-dark outline-none focus:border-[#5B4FE8]"
          >
            {languages.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
          {errors.language ? <p className="mt-1 font-body text-xs text-rose-600">{errors.language.message}</p> : null}
        </label>

        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={isSubmitting}
            className="h-11 rounded-xl border border-gray-300 bg-white px-4 font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70"
          >
            ← Retour
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-xl bg-[#5B4FE8] px-4 font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
          >
            {isSubmitting ? 'Enregistrement…' : 'Continuer →'}
          </button>
        </div>
      </form>
    </section>
  )
}
