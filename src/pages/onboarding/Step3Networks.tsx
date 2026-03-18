import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

type NetworkRow = {
  id: string
  name: unknown
  emoji: string | null
  description: unknown
  multiplier?: number | null
  points_multiplier?: number | null
}

type NetworkCardItem = {
  id: string
  name: string
  emoji: string
  description: string
  multiplier: number
}

function localizedText(value: unknown, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value
  if (value && typeof value === 'object') {
    const rec = value as { fr?: unknown; en?: unknown }
    if (typeof rec.fr === 'string' && rec.fr.trim()) return rec.fr
    if (typeof rec.en === 'string' && rec.en.trim()) return rec.en
  }
  return fallback
}

function NetworkChoiceCard({
  network,
  selected,
  onToggle,
}: {
  network: NetworkCardItem
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative rounded-2xl border-2 p-4 text-left transition ${
        selected
          ? 'border-[#5B4FE8] bg-[#F1EEFF]'
          : 'border-gray-200 bg-white hover:border-[#5B4FE8]'
      }`}
    >
      {selected ? (
        <span className="absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#5B4FE8] text-white">
          <Check className="h-4 w-4" />
        </span>
      ) : null}

      <div className="flex items-start gap-3 pr-8">
        <span className="text-[2rem] leading-none" aria-hidden="true">
          {network.emoji}
        </span>

        <div className="min-w-0">
          <p className="truncate font-display text-lg font-bold text-dark">{network.name}</p>
          <p className="mt-1 line-clamp-2 font-body text-sm text-gray-600">{network.description}</p>
          <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
            x{network.multiplier.toFixed(1)}
          </span>
        </div>
      </div>
    </button>
  )
}

export default function Step3Networks() {
  const { goPrev, goNext, selectedNetworkIds, setNetworks } = useOnboarding()

  const [items, setItems] = useState<NetworkCardItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedNetworkIds)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const primary = await supabase
        .from('networks')
        .select('id, name, emoji, description, multiplier, points_multiplier')
        .eq('status', 'active')

      let rows = primary.data as NetworkRow[] | null
      let loadError = primary.error

      if (loadError) {
        const fallback = await supabase
          .from('networks')
          .select('id, name, emoji, description, multiplier, points_multiplier')
          .eq('is_active', true)

        rows = fallback.data as NetworkRow[] | null
        loadError = fallback.error
      }

      if (cancelled) return

      if (loadError) {
        setItems([])
        setLoading(false)
        setError(loadError.message)
        return
      }

      const mapped: NetworkCardItem[] = (rows ?? []).map((row) => ({
        id: row.id,
        name: localizedText(row.name, 'Réseau'),
        emoji: row.emoji?.trim() || '🌐',
        description: localizedText(row.description, 'Description non disponible'),
        multiplier: Number(row.multiplier ?? row.points_multiplier ?? 1),
      }))

      setItems(mapped)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedCount = selectedIds.length

  const countLabel = useMemo(() => {
    if (selectedCount <= 1) return `${selectedCount} réseau sélectionné`
    return `${selectedCount} réseaux sélectionnés`
  }, [selectedCount])

  const toggleNetwork = (networkId: string) => {
    setError(null)
    setSelectedIds((prev) =>
      prev.includes(networkId) ? prev.filter((id) => id !== networkId) : [...prev, networkId],
    )
  }

  const handleContinue = async () => {
    setError(null)

    if (selectedIds.length < 1) {
      setError('Sélectionnez au moins 1 réseau pour continuer.')
      return
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError(authError?.message ?? 'Utilisateur introuvable.')
      return
    }

    const userId = authData.user.id

    setSubmitting(true)

    const rows = selectedIds.map((networkId) => ({ user_id: userId, network_id: networkId }))

    const primaryInsert = await supabase.from('user_networks').insert(rows)

    if (primaryInsert.error) {
      const fallbackRows = selectedIds.map((networkId) => ({ client_id: userId, network_id: networkId }))
      const fallbackInsert = await supabase.from('network_clients').insert(fallbackRows)

      if (fallbackInsert.error) {
        setSubmitting(false)
        setError(fallbackInsert.error.message)
        return
      }
    }

    setNetworks(selectedIds)
    setSubmitting(false)
    goNext()
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <header>
        <h1 className="font-display text-3xl font-extrabold text-dark">Choisissez vos réseaux</h1>
        <p className="mt-1 font-body text-sm text-gray-600">Sélection multiple autorisée. Au moins 1 réseau requis.</p>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((network) => (
          <NetworkChoiceCard
            key={network.id}
            network={network}
            selected={selectedIds.includes(network.id)}
            onToggle={() => toggleNetwork(network.id)}
          />
        ))}

        <div className="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/30 p-4 text-center text-violet-700">
          <p className="font-display text-4xl font-extrabold leading-none">+</p>
          <p className="mt-2 font-body text-sm font-semibold">17 autres réseaux disponibles</p>
        </div>
      </div>

      <p className="mt-3 font-body text-sm font-semibold text-gray-700">{countLabel}</p>

      {loading ? <p className="mt-2 font-body text-sm text-gray-500">Chargement des réseaux…</p> : null}
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
