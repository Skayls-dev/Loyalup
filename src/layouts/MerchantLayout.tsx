import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  CreditCard,
  Gauge,
  LayoutDashboard,
  LogOut,
  QrCode,
  Settings,
  ShoppingBag,
  Tags,
  Users,
} from 'lucide-react'
import { useAuth } from '../modules/auth/hooks/useAuth'

interface MerchantLayoutProps {
  children: ReactNode
  activePage: string
}

type NavItem = {
  key: string
  label: string
  to: string
  icon: typeof LayoutDashboard
  badge?: string
}

const topNav: NavItem[] = [
  { key: 'overview', label: "Vue d'ensemble", to: '/merchant', icon: LayoutDashboard },
  { key: 'qr', label: 'Générer QR', to: '/merchant/qr', icon: QrCode, badge: '!' },
  { key: 'offers', label: 'Mes offres', to: '/merchant/offers', icon: Tags },
  { key: 'clients', label: 'Clients fidèles', to: '/merchant/clients', icon: Users },
]

const analyticsNav: NavItem[] = [
  { key: 'transactions', label: 'Transactions', to: '/merchant/transactions', icon: CreditCard },
  { key: 'performance', label: 'Performance', to: '/merchant/performance', icon: Gauge },
  { key: 'networks', label: 'Réseaux', to: '/merchant/networks', icon: BarChart3, badge: '4' },
]

const shopNav: NavItem[] = [
  { key: 'settings', label: 'Paramètres', to: '/merchant/settings', icon: Settings },
  { key: 'subscription', label: 'Abonnement', to: '/merchant/subscription', icon: ShoppingBag },
]

function detectActivePage(pathname: string): string {
  const all = [...topNav, ...analyticsNav, ...shopNav]
  const match = all.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return match?.key ?? 'overview'
}

function NavItemLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      title={item.label}
      className={`group flex items-center justify-center gap-3 rounded-md px-2 py-2.5 text-sm transition lg:justify-start lg:px-3 ${
        active
          ? 'bg-[#FFF3EE] font-semibold text-[#FF6B35]'
          : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="hidden truncate lg:inline">{item.label}</span>
      {item.badge ? (
        <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold lg:inline-flex ${active ? 'bg-[#FF6B35] text-white' : 'bg-[#FFF3EE] text-[#FF6B35]'}`}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  )
}

function MobileBottomNav({
  currentActive,
  onLogout,
  logoutLoading,
}: {
  currentActive: string
  onLogout: () => void
  logoutLoading: boolean
}) {
  const mobileNav: NavItem[] = [
    { key: 'overview', label: 'Accueil', to: '/merchant', icon: LayoutDashboard },
    { key: 'qr', label: 'QR', to: '/merchant/qr', icon: QrCode },
    { key: 'transactions', label: 'Ventes', to: '/merchant/transactions', icon: CreditCard },
    { key: 'clients', label: 'Clients', to: '/merchant/clients', icon: Users },
    { key: 'settings', label: 'Profil', to: '/merchant/settings', icon: Settings },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur lg:hidden" aria-label="Navigation mobile marchand">
      <div className="grid grid-cols-5 px-1 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        {mobileNav.map((item) => {
          const Icon = item.icon
          const isActive = currentActive === item.key

          return (
            <Link
              key={item.key}
              to={item.to}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
                isActive ? 'text-[#FF6B35]' : 'text-gray-500 hover:text-gray-900'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-[#FF6B35]' : 'text-gray-500'}`} />
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

export function MerchantLayout({ children, activePage }: MerchantLayoutProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile, user, logout, loading } = useAuth()
  const currentActive = activePage?.trim() || detectActivePage(pathname)
  const merchantName = profile?.nom_commerce?.trim() || profile?.nom?.trim() || user?.email?.split('@')[0] || 'Commerce LoyalUp'
  const merchantInitials = merchantName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'LM'

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-gray-200 bg-white lg:flex lg:w-[220px]">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3 lg:justify-start lg:px-5">
          <Link to="/merchant" className="inline-flex items-center gap-2">
            <span className="hidden font-display text-2xl font-extrabold text-dark lg:inline">LoyalUp</span>
            <span className="relative inline-flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35]/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF6B35]" />
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-2 py-4 lg:px-3">
          <div className="space-y-1">
            {topNav.map((item) => (
              <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
            ))}
          </div>

          <div>
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 lg:block">Analyses</p>
            <div className="space-y-1">
              {analyticsNav.map((item) => (
                <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 lg:block">Boutique</p>
            <div className="space-y-1">
              {shopNav.map((item) => (
                <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
              ))}
            </div>
          </div>
        </nav>

        <div className="border-t border-gray-200 px-2 py-3 lg:px-3 lg:py-4">
          <div className="rounded-lg bg-gray-50 p-2 lg:p-3">
            <div className="flex items-center justify-center gap-3 lg:justify-start">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF9A6B] font-body text-sm font-semibold text-white">
              {merchantInitials}
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-body text-sm font-medium text-gray-900">{merchantName}</p>
              <p className="text-xs font-medium text-accent-green">● Partenaire actif</p>
            </div>
            </div>

            <div className="mt-3 hidden gap-2 lg:flex">
              <button
                type="button"
                onClick={() => navigate('/merchant/settings')}
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
        currentActive={currentActive}
        onLogout={() => void logout()}
        logoutLoading={loading}
      />
    </div>
  )
}
