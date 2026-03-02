import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../auth/hooks/useAuth'
import { ValidationPanel } from '../../transactions/components/ValidationPanel'
import { useQRGenerate } from '../hooks/useQRGenerate'
import { useQRRealtime } from '../hooks/useQRRealtime'
import { QRTimerRing } from './QRTimerRing'
import { supabase } from '../../../shared/lib/supabaseClient'

export function QRDisplay() {
  const fallbackAdSlots = useMemo(
    () => [
      {
        id: 'ad-1',
        title: 'Boostez vos visites avec LoyalUp Premium',
        body: 'Activez des campagnes ciblées et augmentez la fréquence de retour client.',
        cta: 'Découvrir Premium',
      },
    ],
    [],
  )

  const { user, profile } = useAuth()
  const isProviderSessionReady = Boolean(user?.id && profile?.role === 'fournisseur')
  const { token, expiresAt, secondsLeft, isLoading, warning, regenerateNow } = useQRGenerate({
    enabled: isProviderSessionReady,
  })
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [providerName, setProviderName] = useState<string>('')
  const [networkBadges, setNetworkBadges] = useState<Array<{ id: string; emoji: string; name: string; multiplier: number }>>([])
  const [adSlots, setAdSlots] = useState<Array<{ id: string; title: string; body: string; cta: string | null }>>(fallbackAdSlots)
  const [activeAdIndex, setActiveAdIndex] = useState(0)
  const { pendingTransaction, clientProfile, clientPoints, clearPending } = useQRRealtime(fournisseurId)

  useEffect(() => {
    const loadAds = async () => {
      const now = Date.now()

      const { data } = await supabase
        .from('scan_screen_ads')
        .select('id, title, body, cta_label, active, display_order, starts_at, ends_at, created_at')
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false })

      const mapped = (data ?? [])
        .map((row) => {
          const startsAtRaw = (row as { starts_at?: string | null }).starts_at
          const endsAtRaw = (row as { ends_at?: string | null }).ends_at
          const startsAt = startsAtRaw ? new Date(startsAtRaw).getTime() : null
          const endsAt = endsAtRaw ? new Date(endsAtRaw).getTime() : null

          if ((startsAt !== null && startsAt > now) || (endsAt !== null && endsAt < now)) {
            return null
          }

          return {
            id: String((row as { id: string }).id),
            title: String((row as { title: string }).title ?? ''),
            body: String((row as { body: string }).body ?? ''),
            cta: (row as { cta_label?: string | null }).cta_label ?? null,
          }
        })
        .filter((row): row is { id: string; title: string; body: string; cta: string | null } => Boolean(row))
        .filter((row) => row.title && row.body)

      setAdSlots(mapped.length > 0 ? mapped : fallbackAdSlots)
      setActiveAdIndex(0)
    }

    loadAds().catch(() => {
      setAdSlots(fallbackAdSlots)
      setActiveAdIndex(0)
    })
  }, [fallbackAdSlots])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveAdIndex((prev) => (prev + 1) % adSlots.length)
    }, 20000)

    return () => {
      window.clearInterval(timer)
    }
  }, [adSlots.length])

  useEffect(() => {
    const loadProvider = async () => {
      if (!user?.id) {
        return
      }

      const { data } = await supabase
        .from('fournisseurs')
        .select('id, nom_commerce')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data?.id) {
        setFournisseurId(data.id)
      }

      if (data?.nom_commerce) {
        setProviderName(data.nom_commerce)
      }

      if (data?.id) {
        const { data: memberships } = await supabase
          .from('network_members')
          .select('network_id, networks!inner(id, name, emoji, points_multiplier)')
          .eq('fournisseur_id', data.id)
          .eq('status', 'active')

        const rows = (memberships ?? []) as Array<{
          network_id: string
          networks:
            | { id: string; name: Record<string, string>; emoji: string; points_multiplier: number }
            | Array<{ id: string; name: Record<string, string>; emoji: string; points_multiplier: number }>
            | null
        }>

        setNetworkBadges(
          rows
            .map((row) => {
              const network = Array.isArray(row.networks) ? row.networks[0] : row.networks
              if (!network) {
                return null
              }

              return {
                id: network.id,
                emoji: network.emoji ?? '✨',
                name: network.name?.fr ?? network.name?.en ?? 'Réseau',
                multiplier: Number(network.points_multiplier ?? 1),
              }
            })
            .filter((item): item is { id: string; emoji: string; name: string; multiplier: number } => Boolean(item)),
        )
      }
    }

    loadProvider().catch(() => null)
  }, [user?.id])

  const statusText = useMemo(() => {
    if (isLoading) {
      return 'Génération du token...'
    }

    if (!token) {
      return 'QR indisponible'
    }

    return 'En attente de scan...'
  }, [isLoading, token])

  const handleValidationPanelDismiss = async () => {
    clearPending()
    await regenerateNow().catch(() => null)
  }

  const activeAd = adSlots[activeAdIndex]

  return (
    <section className="w-full max-w-6xl">
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative min-h-[calc(100vh-8rem)]">
          {!pendingTransaction ? (
            <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center gap-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="text-center">
                <p className="text-sm uppercase tracking-wide text-zinc-400">Fournisseur</p>
                <h1 className="mt-1 text-2xl font-semibold text-zinc-100">
                  {providerName || profile?.nom || 'LoyalUp'}
                </h1>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-lg shadow-black/40">
                {token ? (
                  <QRCodeSVG value={token} size={240} includeMargin />
                ) : (
                  <div className="h-[240px] w-[240px]" />
                )}
              </div>

              <div className="flex flex-col items-center gap-3">
                <QRTimerRing secondsLeft={secondsLeft} total={180} />
                <p className="text-sm text-zinc-400">
                  Expire à {expiresAt ? new Date(expiresAt).toLocaleTimeString() : '--:--:--'}
                </p>
              </div>

              {networkBadges.length > 0 ? (
                <div className="space-y-2 text-center">
                  <p className="text-xs text-zinc-400">
                    Membre de {networkBadges.length} réseaux · +
                    {Math.round(
                      networkBadges.reduce((sum, network) => sum + (network.multiplier - 1), 0) * 100,
                    )}
                    % points actifs
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {networkBadges.map((network) => (
                      <span
                        key={network.id}
                        title={network.name}
                        className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-200"
                      >
                        {network.emoji}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <p className="animate-pulse text-sm text-zinc-500">{statusText}</p>
              {warning ? (
                <p className="rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
                  {warning}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="animate-[fadeIn_220ms_ease-out]">
              <ValidationPanel
                pendingTransaction={pendingTransaction}
                clientProfile={clientProfile}
                clientPoints={clientPoints}
                onDismiss={handleValidationPanelDismiss}
              />
            </div>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 lg:sticky lg:top-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Stats commerçant</h3>
          <div className="mt-3 space-y-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-400">Statut QR</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {pendingTransaction ? 'En validation' : 'En attente de scan'}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-400">Temps restant</p>
              <p className="mt-1 text-lg font-bold text-teal-400">{secondsLeft}s</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs text-zinc-400">Points client courant</p>
              <p className="mt-1 text-lg font-bold text-amber-400">{clientPoints} pts</p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Sponsor</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">{activeAd.title}</p>
              <p className="mt-1 text-xs text-zinc-400">{activeAd.body}</p>
              {activeAd.cta ? (
                <button
                  type="button"
                  className="mt-2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200"
                >
                  {activeAd.cta}
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
