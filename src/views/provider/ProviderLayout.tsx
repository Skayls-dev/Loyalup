import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
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
  const { profile, logout, loading } = useAuth()
  const location = useLocation()

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
    </div>
  )
}
