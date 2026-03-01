import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import {
  subscribeToPendingTransactions,
  type PendingTransactionPayload,
  unsubscribe,
} from '../../modules/qr/services/qrService'
import { supabase } from '../../shared/lib/supabaseClient'
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

export function ProviderLayout() {
  const { user, profile, logout, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [fournisseurId, setFournisseurId] = useState<string | null>(null)
  const [incomingValidation, setIncomingValidation] = useState<PendingTransactionPayload | null>(null)

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

    subscribeToPendingTransactions(fournisseurId, (payload) => {
      if (location.pathname !== '/provider/validate') {
        setIncomingValidation(payload)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [fournisseurId, location.pathname, navigate])

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

  const handleOpenValidations = () => {
    setIncomingValidation(null)
    navigate('/provider/validate')
  }

  const handleDismissValidationPopup = () => {
    setIncomingValidation(null)
  }

  return (
    <div className="app-shell">
      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 text-center text-sm font-bold leading-8 text-white shadow-sm">
              L
            </div>

            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-200">
                {profile?.nom || 'Nom commerce'}
              </p>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" aria-label="Online" />
            </div>

            <nav className="glass-panel ml-4 hidden items-center gap-1 rounded-2xl p-1.5 md:flex">
              {providerMenu.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 ${
                    isMenuItemActive(item.to)
                      ? 'bg-indigo-500/30 text-indigo-100 shadow-sm'
                      : 'text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-100'
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
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Déconnexion...' : 'Logout'}
          </button>
          <MainMenu items={providerMenu} />
        </div>
      </header>

      <div className="glass-panel border-x-0 px-4 py-2 md:hidden">
        <nav className="glass-panel flex gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none]">
          {providerMenu.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70 ${
                isMenuItemActive(item.to)
                  ? 'bg-indigo-500/30 text-indigo-100 shadow-sm'
                  : 'text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl items-center justify-center p-4 md:p-6">
        <Outlet />
      </main>

      {incomingValidation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100 shadow-2xl">
            <h3 className="text-base font-semibold">Nouveau scan détecté</h3>
            <p className="mt-2 text-sm text-zinc-300">
              Un client vient de scanner votre QR code. Voulez-vous ouvrir la page de validation maintenant ?
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Heure du scan : {new Date(incomingValidation.created_at).toLocaleTimeString()}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissValidationPopup}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700"
              >
                Plus tard
              </button>
              <button
                type="button"
                onClick={handleOpenValidations}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Ouvrir Validations
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
