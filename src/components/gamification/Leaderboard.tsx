import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TierLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

type LeaderboardPlayer = {
  id: string
  firstName: string
  lastName: string
  tier: TierLevel
  total: number
}

type NetworkOption = {
  id: string
  name: string
  emoji: string
}

type UseLeaderboardResult = {
  players: LeaderboardPlayer[]
  loading: boolean
  error: string | null
  refetch: () => void
}

type UseUserNetworksResult = {
  networks: NetworkOption[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Record<TierLevel, { bg: string; text: string; label: string }> = {
  Bronze:   { bg: '#FDF0E0', text: '#A0522D', label: 'Bronze'  },
  Silver:   { bg: '#F0F0F5', text: '#5A5A6A', label: 'Argent'  },
  Gold:     { bg: '#FFF8E1', text: '#B8860B', label: 'Or'      },
  Platinum: { bg: '#EAF4FD', text: '#1D6CA4', label: 'Platine' },
}

const TIER_THRESHOLDS: Array<{ level: TierLevel; min: number }> = [
  { level: 'Platinum', min: 10000 },
  { level: 'Gold',     min: 6000  },
  { level: 'Silver',   min: 2500  },
  { level: 'Bronze',   min: 0     },
]

const AVATAR_GRADIENTS: Array<[string, string]> = [
  ['#7C3AED', '#4F46E5'],
  ['#DB2777', '#9333EA'],
  ['#0891B2', '#0D9488'],
  ['#059669', '#10B981'],
  ['#D97706', '#F59E0B'],
  ['#DC2626', '#F97316'],
  ['#7C3AED', '#EC4899'],
  ['#1D4ED8', '#6366F1'],
]

const MEDALS = ['🥇', '🥈', '🥉']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTier(points: number): TierLevel {
  for (const { level, min } of TIER_THRESHOLDS) {
    if (points >= min) return level
  }
  return 'Bronze'
}

function avatarGradient(id: string): [string, string] {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useLeaderboard(networkId: string, limit = 7): UseLeaderboardResult {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetch = async () => {
    if (!networkId) {
      setPlayers([])
      setLoading(false)
      setError(null)
      return
    }

    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    const { data, error: queryError } = await supabase
      .from('network_clients')
      .select('client_id, total_network_points, profiles!inner(prenom, nom)')
      .eq('network_id', networkId)
      .order('total_network_points', { ascending: false })
      .limit(Math.min(50, Math.max(1, limit)))

    if (ac.signal.aborted) return

    if (queryError) {
      setError(queryError.message)
      setLoading(false)
      return
    }

    type Row = {
      client_id: string
      total_network_points: number
      profiles:
        | { prenom: string | null; nom: string | null }
        | Array<{ prenom: string | null; nom: string | null }>
        | null
    }

    const mapped: LeaderboardPlayer[] = ((data ?? []) as Row[]).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      const total = Number(row.total_network_points ?? 0)
      return {
        id: row.client_id,
        firstName: profile?.prenom?.trim() ?? '',
        lastName: profile?.nom?.trim() ?? '',
        tier: resolveTier(total),
        total,
      }
    })

    setPlayers(mapped)
    setLoading(false)
  }

  // Initial fetch + re-fetch on networkId change
  useEffect(() => { void fetch() }, [networkId, limit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription to network_clients changes
  useEffect(() => {
    if (!networkId) return

    const channel = supabase
      .channel(`leaderboard:network_clients:${networkId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'network_clients',
          filter: `network_id=eq.${networkId}`,
        },
        () => void fetch(),
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [networkId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { players, loading, error, refetch: fetch }
}

function useUserNetworks(userId: string): UseUserNetworksResult {
  const [networks, setNetworks] = useState<NetworkOption[]>([])

  useEffect(() => {
    if (!userId) { setNetworks([]); return }

    const run = async () => {
      const { data, error } = await supabase
        .from('network_clients')
        .select('network_id, networks:network_id(id, name, emoji)')
        .eq('client_id', userId)

      if (error) return

      type Row = {
        network_id: string
        networks:
          | { id: string; name: string | null; emoji: string | null }
          | Array<{ id: string; name: string | null; emoji: string | null }>
          | null
      }

      const opts: NetworkOption[] = ((data ?? []) as Row[])
        .map((row) => {
          const net = Array.isArray(row.networks) ? row.networks[0] : row.networks
          if (!net) return null
          return {
            id: net.id ?? row.network_id,
            name: net.name ?? 'Réseau',
            emoji: net.emoji ?? '🌐',
          }
        })
        .filter((n): n is NetworkOption => n !== null)

      setNetworks(opts)
    }

    void run()
  }, [userId])

  return { networks }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PlayerAvatar({ id, initial }: { id: string; initial: string }) {
  const [from, to] = avatarGradient(id)
  return (
    <div
      aria-hidden
      style={{
        width: 29,
        height: 29,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        color: '#fff',
        fontFamily: 'var(--font-display, Syne, sans-serif)',
      }}
    >
      {initial.toUpperCase()}
    </div>
  )
}

function TierBadge({ tier }: { tier: TierLevel }) {
  const { bg, text, label } = TIER_COLORS[tier]
  return (
    <span
      style={{
        backgroundColor: bg,
        color: text,
        borderRadius: 999,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'var(--font-body, DM Sans, sans-serif)',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export type LeaderboardProps = {
  networkId: string
  userId: string
}

export default function Leaderboard({ networkId, userId }: LeaderboardProps) {
  const [selectedNetworkId, setSelectedNetworkId] = useState(networkId)

  // Sync incoming prop changes (e.g. parent switches active network)
  useEffect(() => { setSelectedNetworkId(networkId) }, [networkId])

  const { players, loading, error } = useLeaderboard(selectedNetworkId)
  const { networks } = useUserNetworks(userId)

  // "Encore X pts pour rejoindre le top 3" footer
  const thirdPlaceTotal = players[2]?.total ?? null
  const myEntry = players.find((p) => p.id === userId) ?? null
  const ptsToTop3 =
    thirdPlaceTotal !== null && myEntry !== null && myEntry.total < thirdPlaceTotal
      ? thirdPlaceTotal - myEntry.total + 1
      : null

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h3
          className="text-sm font-semibold text-slate-900"
          style={{ fontFamily: 'var(--font-display, Syne, sans-serif)' }}
        >
          🏆 Classement réseau
        </h3>

        {/* Network selector — shown only when user is in multiple networks */}
        {networks.length > 1 ? (
          <select
            className="rounded-lg border border-slate-200 bg-slate-50 py-1 pl-2 pr-6 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-violet-400"
            style={{
              fontFamily: 'var(--font-body, DM Sans, sans-serif)',
              maxWidth: 144,
              appearance: 'auto',
            }}
            value={selectedNetworkId}
            onChange={(e) => setSelectedNetworkId(e.target.value)}
            aria-label="Choisir un réseau"
          >
            {networks.map((net) => (
              <option key={net.id} value={net.id}>
                {net.emoji} {net.name}
              </option>
            ))}
          </select>
        ) : networks.length === 1 ? (
          <span
            className="text-xs text-slate-500"
            style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}
          >
            {networks[0].emoji} {networks[0].name}
          </span>
        ) : null}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2 px-4 pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : error ? (
        <p className="px-4 pb-4 text-xs text-rose-600">{error}</p>
      ) : players.length === 0 ? (
        <p className="px-4 pb-4 text-xs text-slate-500">Aucune donnée pour ce réseau.</p>
      ) : (
        <div className="pb-2">
          {players.map((player, idx) => {
            const isMe = player.id === userId
            const initial =
              player.firstName
                ? player.firstName.charAt(0)
                : player.lastName
                  ? player.lastName.charAt(0)
                  : '?'
            const displayName =
              [player.firstName, player.lastName].filter(Boolean).join(' ') || 'Utilisateur'

            return (
              <div
                key={player.id}
                className="flex items-center gap-3 py-[9px] px-4"
                style={
                  isMe
                    ? { backgroundColor: 'var(--color-primary-light, #EBE9FF)' }
                    : undefined
                }
              >
                {/* Rank */}
                <div className="flex w-6 flex-shrink-0 items-center justify-center">
                  {idx < 3 ? (
                    <span style={{ fontSize: 16, lineHeight: 1 }}>{MEDALS[idx]}</span>
                  ) : (
                    <span
                      className="text-xs font-medium text-slate-400"
                      style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}
                    >
                      {idx + 1}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <PlayerAvatar id={player.id} initial={initial} />

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <span
                    className="block truncate text-xs"
                    style={{
                      fontFamily: 'var(--font-body, DM Sans, sans-serif)',
                      fontWeight: isMe ? 700 : 400,
                      color: isMe
                        ? 'var(--color-primary, #5B4FE8)'
                        : 'var(--color-gray-800, #1B1B26)',
                    }}
                  >
                    {displayName}
                    {isMe && (
                      <span
                        className="ml-1"
                        style={{
                          fontWeight: 400,
                          color: 'var(--color-primary, #5B4FE8)',
                          opacity: 0.65,
                        }}
                      >
                        (moi)
                      </span>
                    )}
                  </span>
                </div>

                {/* Tier badge */}
                <TierBadge tier={player.tier} />

                {/* Points */}
                <span
                  className="flex-shrink-0 text-right text-xs"
                  style={{
                    fontFamily: 'var(--font-display, Syne, sans-serif)',
                    fontWeight: 700,
                    color: 'var(--color-gray-800, #1B1B26)',
                    minWidth: 52,
                  }}
                >
                  {player.total.toLocaleString('fr-FR')}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      {ptsToTop3 !== null && (
        <div
          className="border-t border-slate-100 px-4 py-[10px]"
          style={{ backgroundColor: 'var(--color-gray-50, #F8F8FA)' }}
        >
          <p
            className="text-center text-xs text-slate-500"
            style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}
          >
            Encore{' '}
            <span
              className="font-semibold"
              style={{ color: 'var(--color-primary, #5B4FE8)' }}
            >
              {ptsToTop3.toLocaleString('fr-FR')} pts
            </span>{' '}
            pour rejoindre le top&nbsp;3
          </p>
        </div>
      )}
    </div>
  )
}
