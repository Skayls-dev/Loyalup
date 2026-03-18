import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  Coins,
  Gift,
  History,
  LayoutDashboard,
  Network,
  QrCode,
  Settings,
  Swords,
} from 'lucide-react'

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

export function DashboardLayout({ children, activePage }: DashboardLayoutProps) {
  const { pathname } = useLocation()
  const routeActive = detectActiveFromPath(pathname)
  const currentActivePage = activePage?.trim() ? activePage : routeActive

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-20 flex-col border-r border-gray-200 bg-white lg:w-[220px]">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3 lg:justify-start lg:px-5">
          <Link to="/dashboard" className="inline-flex items-center gap-2">
            <span className="hidden font-display text-2xl font-extrabold text-dark lg:inline">LoyalUp</span>
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
          <div className="flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-2 lg:justify-start lg:p-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#8B7FF5] font-body text-sm font-semibold text-white">
              AM
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-body text-sm font-medium text-gray-900">Amina M.</p>
              <p className="text-xs font-medium text-accent-green">Gold Member</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-20 h-screen overflow-y-auto p-8 lg:ml-[220px]">{children}</main>
    </div>
  )
}
