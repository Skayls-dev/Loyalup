import { CreditCard, QrCode, Tag, Trophy, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { MainMenu } from '../../shared/components/MainMenu'

const clientMainMenu = [
  { to: '/client', label: 'Mes cartes' },
  { to: '/client/scan', label: 'Scanner' },
  { to: '/client/history', label: 'Historique' },
  { to: '/client/gamification', label: 'Défis' },
  { to: '/client/promotions', label: 'Promotions' },
  { to: '/client/profile', label: 'Profil' },
]

export function ClientLayout() {
  const { logout, loading } = useAuth()
  const location = useLocation()
  const isScanRoute = location.pathname === '/client/scan'
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [promoBadgeCount, setPromoBadgeCount] = useState(0)

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>
      if (!custom.detail?.message) {
        return
      }

      setToastMessage(custom.detail.message)
      setPromoBadgeCount((prev) => prev + 1)

      window.setTimeout(() => {
        setToastMessage(null)
      }, 3200)
    }

    window.addEventListener('promo:toast', onToast as EventListener)
    return () => {
      window.removeEventListener('promo:toast', onToast as EventListener)
    }
  }, [])

  useEffect(() => {
    if (location.pathname === '/client/promotions') {
      setPromoBadgeCount(0)
    }
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="app-shell">
      <header
        className={`glass-panel sticky top-0 z-20 border-x-0 border-t-0 ${
          isScanRoute ? 'hidden' : ''
        }`}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-indigo-500 to-sky-400 text-center text-sm font-bold leading-7 text-white shadow-sm">
              L
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-100">LoyalUp</span>
          </div>

          <div className="flex items-center gap-2">
            <MainMenu items={clientMainMenu} />
            <button
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? '...' : 'Logout'}
            </button>
            <button
              type="button"
              className="glass-panel flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-slate-200"
              aria-label="Profil utilisateur"
            >
              U
            </button>
          </div>
        </div>
      </header>

      <main
        className={`w-full pb-28 ${
          isScanRoute ? 'px-0 pt-0' : 'mx-auto max-w-5xl px-4 pt-4'
        }`}
      >
        {toastMessage ? (
          <div className="glass-panel mb-3 rounded-xl border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {toastMessage}
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="glass-panel-strong fixed bottom-0 left-0 right-0 z-30 border-x-0 border-b-0">
        <div className={`grid h-20 w-full grid-cols-5 ${isScanRoute ? 'px-1' : 'mx-auto max-w-5xl px-2'}`}>
          <NavItem to="/client" label="Mes cartes" icon={<CreditCard className="h-5 w-5" />} />
          <NavItem
            to="/client/scan"
            label="Scanner"
            icon={<QrCode className="h-5 w-5" />}
            accent
          />
          <NavItem to="/client/gamification" label="Défis" icon={<Trophy className="h-5 w-5" />} />
          <NavItem
            to="/client/promotions"
            label="🏷️ Promos"
            icon={<Tag className="h-5 w-5" />}
            badgeCount={promoBadgeCount}
          />
          <NavItem to="/client/profile" label="Profil" icon={<User className="h-5 w-5" />} />
        </div>
      </nav>
    </div>
  )
}

type NavItemProps = {
  to: string
  label: string
  icon: ReactNode
  accent?: boolean
  badgeCount?: number
}

function NavItem({ to, label, icon, accent = false, badgeCount = 0 }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        const baseClass =
          'flex flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition'

        if (accent) {
          if (isActive) {
            return `${baseClass} bg-violet-500/30 text-violet-100`
          }

          return `${baseClass} text-violet-300 hover:bg-violet-500/15`
        }

        if (isActive) {
          return `${baseClass} bg-indigo-500/30 text-indigo-100`
        }

        return `${baseClass} text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-100`
      }}
    >
      <span className="relative">
        {icon}
        {badgeCount > 0 ? (
          <span className="absolute -right-2 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-semibold text-zinc-950">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        ) : null}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}
