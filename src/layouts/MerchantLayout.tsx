import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BarChart3,
  CreditCard,
  Gauge,
  LayoutDashboard,
  QrCode,
  Settings,
  ShoppingBag,
  Tags,
  Users,
} from 'lucide-react'

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

export function MerchantLayout({ children, activePage }: MerchantLayoutProps) {
  const { pathname } = useLocation()
  const currentActive = activePage?.trim() || detectActivePage(pathname)

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-20 flex-col border-r border-gray-200 bg-white lg:w-[220px]">
        <div className="flex h-16 items-center justify-center border-b border-gray-200 px-3 lg:justify-start lg:px-5">
          <Link to="/merchant" className="inline-flex items-center gap-2">
            <span className="hidden font-display text-2xl font-extrabold text-dark lg:inline">LoyalUp</span>
            <span className="relative inline-flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35]/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#FF6B35]" />
            </span>
            <span className="hidden rounded-full bg-[#FFF3EE] px-2 py-0.5 text-[11px] font-semibold text-[#FF6B35] lg:inline-flex">
              Marchand
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
          <div className="flex items-center justify-center gap-3 rounded-lg bg-gray-50 p-2 lg:justify-start lg:p-3">
            <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#FF6B35] to-[#FF9A6B] font-body text-sm font-semibold text-white">
              KM
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-body text-sm font-medium text-gray-900">Kongo Market</p>
              <p className="text-xs font-medium text-accent-green">● Partenaire actif</p>
            </div>
          </div>
        </div>
      </aside>

      <main className="ml-20 h-screen overflow-y-auto p-8 lg:ml-[220px]">{children}</main>
    </div>
  )
}
