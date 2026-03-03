import { CreditCard, QrCode, Tag, Trophy, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { Badge, SecondaryButton } from '../../shared/components/client-ui'

export function ClientLayout() {
  const { logout, loading } = useAuth()
  const navigate = useNavigate()
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <header
        className={`sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl ${
          isScanRoute ? 'hidden' : ''
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 text-center text-sm font-bold leading-8 text-white shadow-sm shadow-slate-900/5">
              L
            </div>
            <span className="text-sm font-semibold tracking-wide text-slate-900">LoyalUp</span>
          </div>

          <div className="flex items-center gap-2">
            <SecondaryButton
              type="button"
              onClick={() => navigate('/client/profile')}
              className="h-9 px-3"
            >
              Profil
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={handleLogout}
              disabled={loading}
              className="h-9 px-3"
            >
              {loading ? '...' : 'Logout'}
            </SecondaryButton>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-sm shadow-slate-900/5"
              aria-label="Profil utilisateur"
            >
              U
            </button>
          </div>
        </div>
      </header>

      <main
        className={`w-full pb-28 ${
          isScanRoute ? 'px-0 pt-0' : 'mx-auto max-w-6xl px-4 pt-5 md:px-6'
        }`}
      >
        {toastMessage ? (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm shadow-slate-900/5">
            {toastMessage}
          </div>
        ) : null}
        <Outlet />
      </main>

      <nav className="fixed bottom-4 left-1/2 z-30 w-[min(96%,820px)] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/70 p-2 shadow-lg shadow-slate-900/10 backdrop-blur-xl">
        <div className={`grid h-16 w-full grid-cols-5 ${isScanRoute ? 'px-0' : 'px-1'}`}>
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
          'flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50'

        if (accent) {
          if (isActive) {
            return `${baseClass} bg-indigo-100 text-indigo-700`
          }

          return `${baseClass} text-slate-500 hover:bg-slate-100 hover:text-indigo-700`
        }

        if (isActive) {
          return `${baseClass} bg-indigo-100 text-indigo-700`
        }

        return `${baseClass} text-slate-500 hover:bg-slate-100 hover:text-slate-900`
      }}
    >
      <span className="relative">
        {icon}
        {badgeCount > 0 ? (
          <Badge variant="success">{badgeCount > 9 ? '9+' : badgeCount}</Badge>
        ) : null}
      </span>
      <span>{label}</span>
    </NavLink>
  )
}
