import { useEffect, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

type NetworkCard = {
  id: string
  slug: string
  name: string
  emoji: string
  tagline: string
  multiplier: number
  welcomeBonus: number
  primaryColor: string
}

type NetworkRow = {
  id: string
  slug: string | null
  name: unknown
  emoji: string | null
  tagline: unknown
  points_multiplier: number | string | null
  welcome_bonus_points: number | string | null
  primary_color: string | null
}

function localizedText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (value && typeof value === 'object') {
    const record = value as { fr?: unknown; en?: unknown }
    if (typeof record.fr === 'string' && record.fr.trim()) {
      return record.fr.trim()
    }
    if (typeof record.en === 'string' && record.en.trim()) {
      return record.en.trim()
    }
  }

  return fallback
}

export default function Step2Network() {
  const { goNext, goPrev, setNetworks, selectedNetworkIds } = useOnboarding()
  const [networks, setNetworksList] = useState<NetworkCard[]>([])
  const [selected, setSelected] = useState<string[]>(selectedNetworkIds)

  void goPrev

  useEffect(() => {
    let cancelled = false

    async function loadNetworks() {
      const { data } = await supabase
        .from('networks')
        .select('id, slug, name, emoji, tagline, points_multiplier, welcome_bonus_points, primary_color')
        .eq('is_active', true)
        .eq('is_public', true)
        .eq('is_draft', false)
        .order('is_featured', { ascending: false })
        .limit(6)

      if (cancelled) {
        return
      }

      const mapped = ((data ?? []) as NetworkRow[]).map((row) => ({
        id: row.id,
        slug: row.slug ?? '',
        name: localizedText(row.name, 'Réseau'),
        emoji: row.emoji?.trim() || '🌐',
        tagline: localizedText(row.tagline, 'Réseau partenaire Looyaal'),
        multiplier: Number(row.points_multiplier ?? 1),
        welcomeBonus: Number(row.welcome_bonus_points ?? 0),
        primaryColor: row.primary_color?.trim() || '#5B4FE8',
      }))

      setNetworksList(mapped)
    }

    void loadNetworks()

    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (networkId: string) => {
    setSelected((prev) => {
      if (prev.includes(networkId)) {
        return prev.filter((id) => id !== networkId)
      }

      if (prev.length >= 3) {
        return prev
      }

      return [...prev, networkId]
    })
  }

  const canContinue = selected.length >= 1

  const onContinue = () => {
    setNetworks(selected)
    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-2xl">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Choisissez votre réseau</h1>
        <p className="mt-1 font-body text-sm text-gray-600">
          Chaque réseau multiplie vos points chez ses marchands partenaires.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {networks.map((network) => {
          const isSelected = selected.includes(network.id)
          return (
            <button
              key={network.id}
              type="button"
              onClick={() => toggle(network.id)}
              className={`relative rounded-2xl border-2 p-4 text-left transition ${
                isSelected
                  ? 'border-[#5B4FE8] bg-[#F1EEFF]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {isSelected ? (
                <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#5B4FE8] text-xs text-white">
                  ✓
                </span>
              ) : null}
              <span className="text-2xl">{network.emoji}</span>
              <p className="mt-2 font-display text-base font-extrabold text-dark">{network.name}</p>
              <p className="mt-0.5 font-body text-xs text-gray-500">{network.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  x{network.multiplier.toFixed(1)} points
                </span>
                {network.welcomeBonus > 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    +{network.welcomeBonus} pts offerts
                  </span>
                ) : null}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          className="h-11 w-full rounded-xl bg-[#5B4FE8] font-body text-sm font-semibold text-white disabled:opacity-40"
        >
          Continuer →
        </button>
        <button
          type="button"
          onClick={() => {
            setNetworks([])
            goNext()
          }}
          className="font-body text-sm text-gray-400 hover:text-gray-600"
        >
          Choisir plus tard
        </button>
      </div>
    </section>
  )
}
