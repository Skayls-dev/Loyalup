import { useMemo, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

type InterestItem = {
  slug: string
  label: string
  emoji: string
}

const interests: InterestItem[] = [
  { slug: 'alimentation', label: 'Alimentation', emoji: '🛒' },
  { slug: 'cafe-resto', label: 'Café & Resto', emoji: '☕' },
  { slug: 'mode', label: 'Mode', emoji: '👗' },
  { slug: 'bio-sante', label: 'Bio & Santé', emoji: '🌿' },
  { slug: 'culture', label: 'Culture', emoji: '🎵' },
  { slug: 'voyages', label: 'Voyages', emoji: '✈️' },
  { slug: 'librairies', label: 'Librairies', emoji: '📚' },
  { slug: 'bien-etre', label: 'Bien-être', emoji: '💆' },
  { slug: 'sport', label: 'Sport', emoji: '🏋️' },
  { slug: 'maison', label: 'Maison', emoji: '🏠' },
  { slug: 'enfants', label: 'Enfants', emoji: '👶' },
  { slug: 'services', label: 'Services', emoji: '🔧' },
]

export default function Step4Interests() {
  const { goPrev, goNext } = useOnboarding()
  const [selected, setSelected] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedCount = useMemo(() => selected.length, [selected])

  const toggleInterest = (slug: string) => {
    setError(null)
    setSelected((prev) => (prev.includes(slug) ? prev.filter((it) => it !== slug) : [...prev, slug]))
  }

  const handleContinue = async () => {
    setSubmitting(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setSubmitting(false)
      setError(authError?.message ?? 'Utilisateur introuvable.')
      return
    }

    const userId = authData.user.id

    if (selected.length > 0) {
      const { error: deleteError } = await supabase.from('user_interests').delete().eq('user_id', userId)
      if (deleteError && deleteError.code !== '42P01') {
        setSubmitting(false)
        setError(deleteError.message)
        return
      }

      const rows = selected.map((interestSlug) => ({ user_id: userId, interest_slug: interestSlug }))
      const { error: insertError } = await supabase.from('user_interests').insert(rows)

      // If user_interests doesn't exist in this environment, continue gracefully.
      if (insertError && insertError.code !== '42P01') {
        setSubmitting(false)
        setError(insertError.message)
        return
      }
    }

    setSubmitting(false)
    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Vos centres d’intérêt</h1>
        <p className="mt-1 font-body text-sm text-gray-600">Sélectionnez les catégories qui vous ressemblent.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {interests.map((interest) => {
          const selectedState = selected.includes(interest.slug)

          return (
            <button
              key={interest.slug}
              type="button"
              onClick={() => toggleInterest(interest.slug)}
              className={`rounded-full border px-3 py-2 text-sm transition ${
                selectedState
                  ? 'border-[#5B4FE8] bg-[#F1EEFF] font-semibold text-[#5B4FE8]'
                  : 'border-gray-300 bg-white font-medium text-gray-700 hover:border-gray-400'
              }`}
              style={{ borderWidth: '1.5px' }}
            >
              <span aria-hidden="true" className="mr-1.5">
                {interest.emoji}
              </span>
              {interest.label}
            </button>
          )
        })}
      </div>

      <div className="mt-4 rounded-xl border border-violet-200 bg-[#F1EEFF] px-3 py-2">
        <p className="font-body text-sm text-violet-700">
          Looyaal va adapter vos défis et récompenses à ces catégories.
        </p>
      </div>

      <p className="mt-3 font-body text-sm font-semibold text-gray-700">
        {selectedCount} intérêt{selectedCount > 1 ? 's' : ''} sélectionné{selectedCount > 1 ? 's' : ''}
      </p>

      {error ? <p className="mt-2 font-body text-sm text-rose-600">{error}</p> : null}

      <div className="mt-6 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={submitting}
          className="h-11 rounded-xl border border-gray-300 bg-white px-4 font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-70"
        >
          ← Retour
        </button>

        <button
          type="button"
          onClick={() => {
            void handleContinue()
          }}
          disabled={submitting}
          className="h-11 rounded-xl bg-[#5B4FE8] px-4 font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
        >
          {submitting ? 'Enregistrement…' : 'Continuer →'}
        </button>
      </div>
    </section>
  )
}
