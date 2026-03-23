import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Coins,
  Gift,
  History,
  LayoutDashboard,
  LogOut,
  Network,
  QrCode,
  Settings,
  Swords,
  Users,
} from 'lucide-react'
import { useAuth } from '../modules/auth/hooks/useAuth'

interface DashboardLayoutProps {
  children: ReactNode
  activePage: string
}

type NavItem = {
  key: string
  label: string
  to: string
  icon: typeof LayoutDashboard
  badgeCount?: number
}

const primaryNav: NavItem[] = [
  { key: 'overview', label: "Vue d'ensemble", to: '/dashboard', icon: LayoutDashboard },
  { key: 'points', label: 'Mes points', to: '/points', icon: Coins },
  { key: 'networks', label: 'Mes reseaux', to: '/networks', icon: Network },
  { key: 'scanner', label: 'Scanner QR', to: '/scan', icon: QrCode },
]

const activityNav: NavItem[] = [
  { key: 'transactions', label: 'Transactions', to: '/transactions', icon: ArrowLeftRight },
  { key: 'challenges', label: 'Defis', to: '/challenges', icon: Swords, badgeCount: 3 },
  { key: 'transfers', label: 'Transferts', to: '/dashboard/transfers', icon: ArrowLeftRight },
  { key: 'referral', label: 'Parrainage', to: '/dashboard/referral', icon: Users },
  { key: 'rewards', label: 'Recompenses', to: '/rewards', icon: Gift },
]

const accountNav: NavItem[] = [
  { key: 'history', label: 'Historique', to: '/history', icon: History },
  { key: 'settings', label: 'Parametres', to: '/settings', icon: Settings },
]

function detectActiveFromPath(pathname: string): string {
  const allItems = [...primaryNav, ...activityNav, ...accountNav]

  const matched = allItems.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return matched?.key ?? 'overview'
}

function NavLinkItem({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      title={item.label}
      className={`group flex items-center justify-center gap-3 rounded-md px-2 py-2.5 text-sm transition lg:justify-start lg:px-3 ${
        isActive
          ? 'bg-primary-light font-semibold text-primary'
          : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="hidden truncate lg:inline">{item.label}</span>
      {item.badgeCount ? (
        <span className="hidden rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary lg:inline-flex">
          {item.badgeCount}
        </span>
      ) : null}
    </Link>
  )
}

function MobileBottomNav({
  currentActivePage,
  onLogout,
  logoutLoading,
}: {
  currentActivePage: string
  onLogout: () => void
  logoutLoading: boolean
}) {
  const mobileNav: NavItem[] = [
    { key: 'overview', label: 'Accueil', to: '/dashboard', icon: LayoutDashboard },
    { key: 'points', label: 'Points', to: '/points', icon: Coins },
    { key: 'scanner', label: 'Scanner', to: '/scan', icon: QrCode },
    { key: 'networks', label: 'Reseaux', to: '/networks', icon: Network },
    { key: 'settings', label: 'Profil', to: '/settings', icon: Settings },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Navigation mobile">
      <div className="grid grid-cols-5 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {mobileNav.map((item) => {
          const Icon = item.icon
          const isActive = currentActivePage === item.key

          return (
            <Link
              key={item.key}
              to={item.to}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
                isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-primary' : 'text-gray-500'}`} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
      <div className="border-t border-gray-100 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
        <button
          type="button"
          onClick={onLogout}
          disabled={logoutLoading}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Se deconnecter"
        >
          <LogOut className="h-4 w-4" />
          Se deconnecter
        </button>
      </div>
    </nav>
  )
}

export function DashboardLayout({ children, activePage }: DashboardLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, user, logout, loading } = useAuth()
  const routeActive = detectActiveFromPath(pathname)
  const currentActivePage = activePage?.trim() ? activePage : routeActive
  const displayName = [profile?.prenom?.trim(), profile?.nom?.trim()].filter(Boolean).join(' ').trim() || profile?.nom?.trim() || user?.email?.split('@')[0] || 'Membre Looyaal'
  const membership = profile?.role === 'client' ? 'Compte client' : 'Compte actif'

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-gray-200 bg-white lg:flex lg:w-[220px]">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3 lg:justify-start lg:px-5">
          <Link to="/dashboard" className="inline-flex items-center gap-2">
            <span className="hidden font-display text-2xl font-extrabold text-dark lg:inline">Looyaal</span>
            <span className="relative inline-flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/55" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 lg:px-3">
          <div className="space-y-1">
            {primaryNav.map((item) => (
              <NavLinkItem key={item.key} item={item} isActive={currentActivePage === item.key} />
            ))}
          </div>

          <div>
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 lg:block">Activite</p>
            <div className="space-y-1">
              {activityNav.map((item) => (
                <NavLinkItem key={item.key} item={item} isActive={currentActivePage === item.key} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 lg:block">Compte</p>
            <div className="space-y-1">
              {accountNav.map((item) => (
                <NavLinkItem key={item.key} item={item} isActive={currentActivePage === item.key} />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-gray-200 px-2 py-3 lg:px-3 lg:py-4">
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#8B7FF5] font-body text-sm font-semibold text-white">
              {displayName.charAt(0).toUpperCase() || 'L'}
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-body text-sm font-medium text-gray-900">{displayName}</p>
              <p className="truncate text-xs font-medium text-accent-green">{membership}</p>
            </div>
            </div>

            <div className="mt-3 hidden gap-2 lg:flex">
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="inline-flex flex-1 items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Profil
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                disabled={loading}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Se deconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto p-4 pb-28 lg:ml-[220px] lg:p-8 lg:pb-8">{children}</main>
      <MobileBottomNav
        currentActivePage={currentActivePage}
        onLogout={() => void logout()}
        logoutLoading={loading}
      />
    </div>
  )
}
