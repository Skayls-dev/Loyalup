import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import {
  Bell,
  Cog,
  LayoutDashboard,
  LineChart,
  Logs,
  Network,
  ShieldCheck,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useAuth } from '../modules/auth/hooks/useAuth'

interface AdminLayoutProps {
  children: ReactNode
  activePage?: string
  networksCount?: number
}

type NavItem = {
  key: string
  label: string
  to: string
  icon: typeof LayoutDashboard
  badge?: string
}

const mainNav: NavItem[] = [
  { key: 'overview', label: "Vue d'ensemble", to: '/admin', icon: LayoutDashboard },
  { key: 'networks', label: 'Réseaux', to: '/admin/network', icon: Network },
  { key: 'merchants', label: 'Marchands', to: '/admin/merchants', icon: ShoppingCart },
  { key: 'users', label: 'Utilisateurs', to: '/admin/users', icon: Users },
]

const platformNav: NavItem[] = [
  { key: 'analytics', label: 'Analytics', to: '/admin/analytics', icon: LineChart },
  { key: 'subscriptions', label: 'Abonnements', to: '/admin/subscriptions', icon: ShoppingCart },
  { key: 'notifications', label: 'Notifications', to: '/admin/notifications', icon: Bell },
  { key: 'global-config', label: 'Config globale', to: '/admin/config', icon: Cog },
]

const systemNav: NavItem[] = [
  { key: 'permissions', label: 'Permissions', to: '/admin/permissions', icon: ShieldCheck },
  { key: 'logs', label: 'Logs', to: '/admin/logs', icon: Logs },
]

function resolveActiveKey(pathname: string): string {
  const all = [...mainNav, ...platformNav, ...systemNav]
  const match = all.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
  return match?.key ?? 'overview'
}

function NavItemLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon

  return (
    <Link
      to={item.to}
      className={`flex items-center justify-center gap-3 rounded-md px-2 py-2.5 text-sm transition lg:justify-start lg:px-3 ${
        active
          ? 'bg-[#FCEBEB] font-semibold text-[#A32D2D]'
          : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
      title={item.label}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="hidden truncate lg:inline">{item.label}</span>
      {item.badge ? (
        <span
          className={`hidden rounded-full px-2 py-0.5 text-[11px] font-semibold lg:inline-flex ${
            active ? 'bg-[#A32D2D] text-white' : 'bg-[#FCEBEB] text-[#A32D2D]'
          }`}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  )
}

function getAuthMetaRole(user: ReturnType<typeof useAuth>['user']): string | null {
  const meta = user?.app_metadata as { role?: unknown } | undefined
  const userMeta = user?.user_metadata as { role?: unknown } | undefined

  const role = meta?.role ?? userMeta?.role
  return typeof role === 'string' ? role : null
}

function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-600">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    )
  }

  const role = getAuthMetaRole(user)
  if (!user || role !== 'super_admin') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function AdminLayout({ children, activePage, networksCount = 0 }: AdminLayoutProps) {
  const { pathname } = useLocation()
  const currentActive = activePage?.trim() || resolveActiveKey(pathname)

  const navWithBadges = mainNav.map((item) =>
    item.key === 'networks' ? { ...item, badge: String(networksCount) } : item,
  )

  return (
    <AdminGuard>
      <div className="h-screen overflow-hidden bg-gray-50">
        <aside className="fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col border-r border-gray-200 bg-white">
          <div className="flex h-16 items-center border-b border-gray-200 px-5">
            <Link to="/admin" className="inline-flex items-center gap-2.5">
              <span className="relative inline-flex h-3 w-3" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E24B4A]/55" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#E24B4A]" />
              </span>
              <span className="font-display text-2xl font-extrabold text-dark">Looyaal</span>
              <span className="rounded-full bg-[#FCEBEB] px-2 py-0.5 text-[11px] font-semibold text-[#A32D2D]">Admin</span>
            </Link>
          </div>

          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {navWithBadges.map((item) => (
                <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
              ))}
            </div>

            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Plateforme</p>
              <div className="space-y-1">
                {platformNav.map((item) => (
                  <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Système</p>
              <div className="space-y-1">
                {systemNav.map((item) => (
                  <NavItemLink key={item.key} item={item} active={currentActive === item.key} />
                ))}
              </div>
            </div>
          </nav>

          <footer className="border-t border-gray-200 px-3 py-4">
            <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#E24B4A] to-[#A32D2D] font-body text-sm font-semibold text-white">
                SA
              </div>
              <div className="min-w-0">
                <p className="truncate font-body text-sm font-medium text-gray-900">Admin Principal</p>
                <p className="text-xs font-semibold text-[#A32D2D]">Super Admin</p>
              </div>
            </div>
          </footer>
        </aside>

        <main className="ml-[220px] h-screen overflow-y-auto p-8">{children}</main>
      </div>
    </AdminGuard>
  )
}
