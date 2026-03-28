import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Badge, Button } from '../../../components/ui'
import { showToast } from '../../../shared/stores/toastStore'
import { useSumUpConnection } from '../hooks/useSumUpConnection'

type Props = {
  userId: string
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function SumUpConnectionCard({ userId }: Props) {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const handledRef = useRef(false)

  const { connectionStatus, merchantName, merchantCode, connectedAt, isLoading, connect, disconnect } =
    useSumUpConnection(userId)

  // ── Handle OAuth callback return ──────────────────────────────────────────
  useEffect(() => {
    if (handledRef.current) return
    const sumupParam = searchParams.get('sumup')
    if (!sumupParam) return

    handledRef.current = true

    if (sumupParam === 'connected') {
      showToast('SumUp connecté avec succès !', 'success')
      void queryClient.invalidateQueries({ queryKey: ['sumup-connection', userId] })
    } else if (sumupParam === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown'
      showToast(`Erreur lors de la connexion SumUp (${reason})`, 'error')
    }

    // Clean query params without navigating
    const next = new URLSearchParams(searchParams)
    next.delete('sumup')
    next.delete('reason')
    setSearchParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-36 animate-pulse rounded-lg border border-gray-200 bg-white p-5" aria-busy="true" />
    )
  }

  // ── Disconnected ──────────────────────────────────────────────────────────
  if (connectionStatus === 'disconnected') {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Intégration</p>
            <h2 className="mt-2 font-display text-base font-semibold text-dark">
              Connecter votre compte SumUp
            </h2>
            <p className="mt-1 font-body text-sm text-gray-500">
              Vos transactions SumUp s&apos;afficheront automatiquement lors d&apos;un scan de fidélité.
            </p>
          </div>
          <Badge variant="default" className="shrink-0">
            Non connecté
          </Badge>
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              try { await connect() }
              catch (err) { showToast(err instanceof Error ? err.message : 'Impossible de connecter SumUp', 'error') }
            }}
          >
            Connecter SumUp
          </Button>
        </div>
      </section>
    )
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (connectionStatus === 'expired') {
    return (
      <section className="rounded-lg border border-amber-100 bg-amber-50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.16em] text-amber-600">Intégration</p>
            <h2 className="mt-2 font-display text-base font-semibold text-dark">
              Connexion SumUp expirée
            </h2>
            <p className="mt-1 font-body text-sm text-gray-600">
              Veuillez reconnecter votre compte pour continuer à utiliser les transactions automatiques.
            </p>
          </div>
          <Badge variant="warning" className="shrink-0">
            Expiré
          </Badge>
        </div>
        <div className="mt-4">
          <Button
            variant="primary"
            size="sm"
            onClick={async () => {
              try { await connect() }
              catch (err) { showToast(err instanceof Error ? err.message : 'Impossible de connecter SumUp', 'error') }
            }}
          >
            Reconnecter
          </Button>
        </div>
      </section>
    )
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    if (!window.confirm('Voulez-vous vraiment déconnecter votre compte SumUp ?')) return
    try {
      await disconnect()
      showToast('Compte SumUp déconnecté.', 'info')
    } catch {
      showToast('Impossible de déconnecter le compte SumUp.', 'error')
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Intégration</p>
          <h2 className="mt-2 font-display text-base font-semibold text-dark">SumUp connecté</h2>
          {(merchantName ?? merchantCode) && (
            <p className="mt-1 truncate font-body text-sm text-gray-600">
              {[merchantName, merchantCode].filter(Boolean).join(' — ')}
            </p>
          )}
          {connectedAt && (
            <p className="mt-1 font-body text-xs text-gray-400">
              Connecté le {formatDate(connectedAt)}
            </p>
          )}
        </div>
        <Badge variant="success" dot className="shrink-0">
          Actif
        </Badge>
      </div>
      <div className="mt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleDisconnect()}
          className="text-gray-500 hover:text-red-600"
        >
          Déconnecter
        </Button>
      </div>
    </section>
  )
}
