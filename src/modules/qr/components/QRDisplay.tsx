import { useEffect, useMemo, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../../auth/hooks/useAuth'
import { ValidationPanel } from '../../transactions/components/ValidationPanel'
import { useQRGenerate } from '../hooks/useQRGenerate'
import { useQRRealtime } from '../hooks/useQRRealtime'
import { QRTimerRing } from './QRTimerRing'
import { supabase } from '../../../shared/lib/supabaseClient'

export function QRDisplay() {
  const { user, profile } = useAuth()
  const isProviderSessionReady = Boolean(user?.id && profile?.role === 'fournisseur')
  const { token, expiresAt, secondsLeft, isLoading, warning, regenerateNow } = useQRGenerate({
    enabled: isProviderSessionReady,
  })
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [providerName, setProviderName] = useState<string>('')
  const [networkBadges, setNetworkBadges] = useState<Array<{ id: string; emoji: string; name: string; multiplier: number }>>([])
  const { pendingTransaction, clientProfile, clientPoints, clearPending } = useQRRealtime(fournisseurId)

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

  return (
    <section className="w-full">
      {!pendingTransaction ? (
        <div className="w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Fournisseur</p>
              <h1 className="mt-1 text-2xl font-semibold text-zinc-100">
                {providerName || profile?.nom || 'LoyalUp'}
              </h1>
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-lg shadow-black/40">
              {token ? <QRCodeSVG value={token} size={210} includeMargin /> : <div className="h-[210px] w-[210px]" />}
            </div>

            <div className="flex flex-col items-center gap-3">
              <QRTimerRing secondsLeft={secondsLeft} total={180} />
              <p className="text-sm text-zinc-400">
                Expire à {expiresAt ? new Date(expiresAt).toLocaleTimeString() : '--:--:--'}
              </p>
            </div>

            {networkBadges.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">
                  Membre de {networkBadges.length} réseaux · +
                  {Math.round(networkBadges.reduce((sum, network) => sum + (network.multiplier - 1), 0) * 100)}
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
              <p className="w-full rounded-lg border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-300">
                {warning}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="w-full animate-[fadeIn_220ms_ease-out]">
          <ValidationPanel
            pendingTransaction={pendingTransaction}
            clientProfile={clientProfile}
            clientPoints={clientPoints}
            onDismiss={handleValidationPanelDismiss}
          />
        </div>
      )}
    </section>
  )
}
