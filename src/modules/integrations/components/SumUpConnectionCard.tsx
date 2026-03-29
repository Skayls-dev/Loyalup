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

  const {
    connectionStatus,
    merchantName,
    merchantNameSource,
    merchantCode,
    connectedAt,
    isLoading,
    connect,
    disconnect,
    verify,
    isVerifying,
  } =
    useSumUpConnection(userId)

  // ── Handle OAuth callback return ──────────────────────────────────────────
  useEffect(() => {
    if (handledRef.current) return
    const sumupParam = searchParams.get('sumup')
    const sumupWarning = searchParams.get('sumup_warning')
    if (!sumupParam) return

    handledRef.current = true

    if (sumupParam === 'connected') {
      showToast('SumUp connecté avec succès !', 'success')
      if (sumupWarning === 'sandbox_account_detected') {
        showToast('Attention: ce compte semble sandbox. Vérifiez le compte SumUp actif.', 'info')
      }
      void queryClient.invalidateQueries({ queryKey: ['sumup-connection', userId] })
    } else if (sumupParam === 'error') {
      const reason = searchParams.get('reason') ?? 'unknown'
      if (reason === 'sandbox_account_detected') {
        showToast('Compte sandbox détecté. Connectez un compte SumUp production pour activer la caisse.', 'error')
      } else if (reason.includes('invalid_client')) {
        showToast('Échec OAuth SumUp: client_id/client_secret invalide côté serveur.', 'error')
      } else if (reason.includes('invalid_grant')) {
        showToast('Échec OAuth SumUp: code expiré ou déjà utilisé. Relancez la connexion.', 'error')
      } else {
        showToast(`Erreur lors de la connexion SumUp (${reason})`, 'error')
      }
    }

    // Clean query params without navigating
    const next = new URLSearchParams(searchParams)
    next.delete('sumup')
    next.delete('sumup_warning')
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

  const handleVerify = async () => {
    try {
      const result = await verify()
      if (result.alive) {
        showToast('Connexion SumUp active et fonctionnelle.', 'success')
      } else {
        const reasons: Record<string, string> = {
          revoked: 'Le token a été révoqué',
          refresh_failed: 'Impossible de renouveler le token — reconnectez votre compte',
          not_connected: 'Aucune intégration trouvée',
          sumup_401: 'Token rejeté par SumUp — reconnectez votre compte',
          sumup_403: 'Accès refusé par SumUp — reconnectez votre compte',
          network_error: 'Impossible de joindre SumUp',
        }
        const label = reasons[result.reason ?? ''] ?? `Connexion invalide (${result.reason ?? 'unknown'})`
        showToast(label, 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erreur lors de la vérification', 'error')
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
          {merchantNameSource === 'local' && (
            <p className="mt-1 font-body text-xs text-amber-700">
              Nom boutique (Looyaal)
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
      <div className="mt-4 flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={isVerifying}
          onClick={() => void handleVerify()}
          className="text-gray-500 hover:text-green-600"
        >
          {isVerifying ? 'Vérification…' : 'Tester la connexion'}
        </Button>
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
