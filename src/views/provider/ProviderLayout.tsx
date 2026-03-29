import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import {
  subscribeToPendingTransactions,
  type PendingTransactionPayload,
  unsubscribe,
} from '../../modules/qr/services/qrService'
import { ValidationPanel } from '../../modules/transactions/components/ValidationPanel'
import { supabase } from '../../shared/lib/supabaseClient'
import type { Profile } from '../../shared/types'
import { MainMenu } from '../../shared/components/MainMenu'

const providerMenu = [
  { label: 'QR', to: '/provider?tab=qr' },
  { label: 'Dashboard', to: '/provider?tab=dashboard' },
  { label: 'Réseau', to: '/provider/network' },
  { label: 'Clients', to: '/provider?tab=clients' },
  { label: 'Promotions', to: '/provider?tab=promotions' },
  { label: 'Services', to: '/provider?tab=settings' },
  { label: 'White Label', to: '/provider?tab=white-label' },
  { label: 'Developer Portal', to: '/provider?tab=developers' },
  { label: 'Validations', to: '/provider/validate' },
]

function resolveClientName(
  rawNom: string | null | undefined,
  rawEmail: string | null | undefined,
  clientId: string,
): string {
  const nom = (rawNom ?? '').trim()

  if (nom) {
    return nom
  }

  const emailPrefix = (rawEmail ?? '').split('@')[0]?.trim()
  if (emailPrefix) {
    return emailPrefix
  }

  return `Client ${clientId.slice(0, 6)}`
}

export function ProviderLayout() {
  const { user, profile, logout, loading } = useAuth()
  const location = useLocation()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [incomingValidation, setIncomingValidation] = useState<{
    pendingTransaction: PendingTransactionPayload
    clientProfile: Profile | null
    clientPoints: number
    totalVisites: number
  } | null>(null)
  const [lastNotifiedPendingId, setLastNotifiedPendingId] = useState<string | null>(null)

  useEffect(() => {
    const loadProvider = async () => {
      if (!user?.id) {
        setFournisseurId(null)
        return
      }

      const { data } = await supabase
        .from('fournisseurs')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      setFournisseurId(data?.id ?? null)
    }

    loadProvider().catch(() => setFournisseurId(null))
  }, [user?.id])

  useEffect(() => {
    if (!fournisseurId) {
      return
    }

    const handleIncomingPending = async (payload: PendingTransactionPayload) => {
      if (payload.id === lastNotifiedPendingId) {
        return
      }

      if (location.pathname !== '/provider/validate') {
        const [profileResult, pointsResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, role, nom, created_at')
            .eq('id', payload.client_id)
            .maybeSingle(),
          supabase
            .from('client_points')
            .select('solde, total_visites')
            .eq('client_id', payload.client_id)
            .eq('fournisseur_id', payload.fournisseur_id)
            .maybeSingle<{ solde: number | string | null; total_visites: number | string | null }>(),
        ])

        const resolvedProfile =
          profileResult.data && profileResult.data.id
            ? {
                id: profileResult.data.id as string,
                email: (profileResult.data.email as string | undefined) ?? 'email non disponible',
                role: (profileResult.data.role as 'client' | 'fournisseur' | 'admin' | undefined) ?? 'client',
                nom: resolveClientName(
                  profileResult.data.nom as string | undefined,
                  profileResult.data.email as string | undefined,
                  payload.client_id,
                ),
                created_at: (profileResult.data.created_at as string | undefined) ?? payload.created_at,
              }
            : null

        setIncomingValidation({
          pendingTransaction: payload,
          clientProfile: resolvedProfile,
          clientPoints: Number(pointsResult.data?.solde ?? 0),
          totalVisites: Number(pointsResult.data?.total_visites ?? 0),
        })
      }

      setLastNotifiedPendingId(payload.id)
    }

    subscribeToPendingTransactions(fournisseurId, (payload) => {
      handleIncomingPending(payload).catch(() => null)
    })

    const pollIntervalId = window.setInterval(async () => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('pending_transactions')
        .select('id, qr_token_id, client_id, fournisseur_id, status, created_at, expires_at')
        .eq('fournisseur_id', fournisseurId)
        .eq('status', 'pending')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        return
      }

      if (!data) {
        return
      }

      handleIncomingPending(data as PendingTransactionPayload).catch(() => null)
    }, 3000)

    return () => {
      window.clearInterval(pollIntervalId)
      unsubscribe()
    }
  }, [fournisseurId, location.pathname, lastNotifiedPendingId])

  const isMenuItemActive = (to: string) => {
    if (to === '/provider/validate') {
      return location.pathname === '/provider/validate'
    }

    const [path, search = ''] = to.split('?')
    if (location.pathname !== path) {
      return false
    }

    return search.length === 0 || location.search === `?${search}`
  }

  const handleLogout = async () => {
    await logout()
  }

  const handleDismissValidationPopup = () => {
    setIncomingValidation(null)
  }

  return (
    <div className="app-shell">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#060d1a]">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[#3eb8f0] to-[#00e5a0] text-center text-sm font-bold leading-8 text-[#040d1a] shadow-sm">
              L
            </div>

            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-white/90">
                {profile?.nom || 'Nom commerce'}
              </p>
              <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[#00e5a0]" aria-label="Online" />
            </div>

            <nav className="ml-4 hidden items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1.5 md:flex">
              {providerMenu.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3eb8f0]/60 ${
                    isMenuItemActive(item.to)
                      ? 'bg-[#3eb8f0]/[0.08] text-[#3eb8f0]'
                      : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className="rounded-xl border border-white/[0.07] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Déconnexion...' : 'Logout'}
          </button>
          <MainMenu items={providerMenu} />
        </div>
      </header>

      <div className="border-b border-white/[0.07] bg-[#060d1a] px-4 py-2 md:hidden">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1.5 [scrollbar-width:none]">
          {providerMenu.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3eb8f0]/60 ${
                isMenuItemActive(item.to)
                  ? 'bg-[#3eb8f0]/[0.08] text-[#3eb8f0]'
                  : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="min-h-screen w-full overflow-x-hidden px-4 py-4 md:px-6 md:py-5">
        <Outlet />
      </main>

      {incomingValidation ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-2 sm:items-center sm:p-4">
          <div className="my-2 w-full max-w-6xl sm:my-6">
            <ValidationPanel
              pendingTransaction={incomingValidation.pendingTransaction}
              clientProfile={incomingValidation.clientProfile}
              clientPoints={incomingValidation.clientPoints}
              totalVisites={incomingValidation.totalVisites}
              onDismiss={handleDismissValidationPopup}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
