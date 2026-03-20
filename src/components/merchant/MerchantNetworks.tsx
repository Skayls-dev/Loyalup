import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui'
import { supabase } from '../../shared/lib/supabaseClient'

export interface MerchantNetworksProps {
  merchantId: string
  className?: string
}

type MerchantNetwork = {
  id: string
  name: string
  emoji: string
  multiplier: number
  primaryColor: string
  secondaryColor: string | null
}

function networkNameFromRecord(name: unknown): string {
  if (typeof name === 'string' && name.trim()) return name
  if (name && typeof name === 'object') {
    const fr = (name as { fr?: unknown }).fr
    const en = (name as { en?: unknown }).en
    if (typeof fr === 'string' && fr.trim()) return fr
    if (typeof en === 'string' && en.trim()) return en
  }
  return 'Reseau LoyalUp'
}

export function MerchantNetworks({ merchantId, className = '' }: MerchantNetworksProps) {
  const [activeNetworks, setActiveNetworks] = useState<MerchantNetwork[]>([])
  const [availableNetworks, setAvailableNetworks] = useState<MerchantNetwork[]>([])
  const [loading, setLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showBrowser, setShowBrowser] = useState(false)

  useEffect(() => {
    if (!merchantId) {
      setActiveNetworks([])
      setAvailableNetworks([])
      return
    }

    let cancelled = false

    async function loadNetworks() {
      setLoading(true)
      setError(null)

      const [activeRes, allRes] = await Promise.all([
        supabase
          .from('network_members')
          .select('network_id, networks:network_id(id, name, emoji, points_multiplier, primary_color, secondary_color)')
          .eq('fournisseur_id', merchantId)
          .eq('status', 'active'),
        supabase
          .from('networks')
          .select('id, name, emoji, points_multiplier, primary_color, secondary_color, is_active')
          .eq('is_active', true),
      ])

      if (cancelled) return

      if (activeRes.error || allRes.error) {
        setLoading(false)
        setError(activeRes.error?.message ?? allRes.error?.message ?? 'Impossible de charger les reseaux')
        return
      }

      const mappedActive = ((activeRes.data ?? []) as Array<{ network_id: string; networks?: unknown }>)
        .map((row) => {
          const networkRaw = row.networks
          const network = Array.isArray(networkRaw) ? networkRaw[0] : networkRaw
          if (!network || typeof network !== 'object') return null

          const item = network as {
            id?: string
            name?: unknown
            emoji?: string | null
            points_multiplier?: number | null
            primary_color?: string | null
            secondary_color?: string | null
          }

          return {
            id: String(item.id ?? row.network_id),
            name: networkNameFromRecord(item.name),
            emoji: item.emoji?.trim() || '🌍',
            multiplier: Number(item.points_multiplier ?? 1),
            primaryColor: item.primary_color?.trim() || '#5B4FE8',
            secondaryColor: item.secondary_color?.trim() || null,
          }
        })
        .filter((network): network is MerchantNetwork => Boolean(network))

      const activeIds = new Set(mappedActive.map((network) => network.id))

      const mappedAvailable = ((allRes.data ?? []) as Array<{
        id: string
        name?: unknown
        emoji?: string | null
        points_multiplier?: number | null
        primary_color?: string | null
        secondary_color?: string | null
      }>)
        .filter((row) => !activeIds.has(row.id))
        .map((row) => ({
          id: row.id,
          name: networkNameFromRecord(row.name),
          emoji: row.emoji?.trim() || '🌍',
          multiplier: Number(row.points_multiplier ?? 1),
          primaryColor: row.primary_color?.trim() || '#5B4FE8',
          secondaryColor: row.secondary_color?.trim() || null,
        }))

      setActiveNetworks(mappedActive)
      setAvailableNetworks(mappedAvailable)
      setLoading(false)
    }

    void loadNetworks()

    return () => {
      cancelled = true
    }
  }, [merchantId])

  const canJoinAny = useMemo(() => availableNetworks.length > 0, [availableNetworks.length])

  const handleJoin = async (network: MerchantNetwork) => {
    if (!merchantId || joiningId) return

    setJoiningId(network.id)
    setError(null)

    const previousActive = activeNetworks
    const previousAvailable = availableNetworks

    setActiveNetworks((prev) => [...prev, network])
    setAvailableNetworks((prev) => prev.filter((item) => item.id !== network.id))

    const { error: joinError } = await supabase.from('network_members').insert({
      fournisseur_id: merchantId,
      network_id: network.id,
      status: 'active',
      joined_at: new Date().toISOString(),
    })

    if (joinError) {
      setActiveNetworks(previousActive)
      setAvailableNetworks(previousAvailable)
      setError(joinError.message)
    }

    setJoiningId(null)
  }

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Reseaux actifs</p>
        <Button
          variant="soft"
          size="sm"
          className="hover:bg-[#FFF4EE] hover:border-[#FF6B35]/35 hover:text-[#C84E20]"
          onClick={() => setShowBrowser((prev) => !prev)}
        >
          + Rejoindre un reseau
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        {activeNetworks.map((network) => (
          <span
            key={network.id}
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
            style={{
              borderColor: `${network.primaryColor}66`,
              background: `linear-gradient(135deg, ${network.primaryColor}20, ${(network.secondaryColor || network.primaryColor)}20)`,
              color: '#1F2937',
            }}
          >
            <span>{network.emoji}</span>
            <span>{network.name}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px]">x{network.multiplier.toFixed(1)}</span>
          </span>
        ))}

        {!loading && activeNetworks.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun reseau actif.</p> : null}
      </div>

      {showBrowser ? (
        <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/40 p-3">
          <p className="font-body text-xs uppercase tracking-[0.12em] text-violet-700">Explorer les reseaux</p>
          <div className="mt-2 space-y-2">
            {availableNetworks.map((network) => (
              <div key={network.id} className="flex items-center justify-between gap-3 rounded-md border border-violet-100 bg-white px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-body text-sm font-semibold text-dark">
                    {network.emoji} {network.name}
                  </p>
                  <p className="font-body text-xs text-gray-500">Multiplicateur x{network.multiplier.toFixed(1)}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleJoin(network)}
                  loading={joiningId === network.id}
                  disabled={Boolean(joiningId)}
                >
                  Rejoindre
                </Button>
              </div>
            ))}

            {canJoinAny ? null : <p className="font-body text-sm text-gray-500">Tous les reseaux actifs sont deja rejoints.</p>}
          </div>
        </div>
      ) : null}

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
