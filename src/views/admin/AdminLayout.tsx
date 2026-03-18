import { Menu, LayoutGrid, Network, LogOut } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useAdminGuard } from '../../hooks/useAdminGuard'

const adminMainMenu: Array<{ to: string; label: string; icon: typeof LayoutGrid }> = [
  { to: '/admin', label: 'Dashboard admin', icon: LayoutGrid },
  { to: '/admin/networks', label: 'Réseaux', icon: Network },
]

export function AdminLayout() {
  const { logout, loading, profile } = useAuth()
  const { isAdmin, isLoading } = useAdminGuard()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const isDashboardActive = location.pathname === '/admin'

  const sidebarWidthClass = sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
  const mainPaddingClass = sidebarCollapsed ? 'pl-[72px]' : 'pl-[240px]'

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f2f1] text-[#323130]">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div
      className="min-h-screen bg-[#f3f2f1] text-[#323130]"
      style={{ fontFamily: 'Segoe UI, system-ui, -apple-system, sans-serif' }}
    >
      <header className="fixed inset-x-0 top-0 z-40 border-b border-[#106ebe] bg-[#0078D4]">
        <div className="flex h-14 w-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/40 text-white hover:bg-white/10"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="h-8 w-8 rounded bg-white/15 text-center text-sm font-bold leading-8 text-white shadow-sm">
              L
            </div>
            <div>
              <p className="text-sm font-semibold text-white">LoyalUp Admin Portal</p>
              <p className="text-xs text-white/85">Cloud Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded border border-white/35 bg-white/10 px-2.5 py-1 text-xs text-white">
              {profile?.email ?? 'admin@loyalup.test'}
            </div>
            <button
              type="button"
              onClick={() => {
                logout().catch(() => undefined)
              }}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1 rounded border border-white/35 bg-white/10 px-3 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-70"
            >
              <LogOut className="h-3.5 w-3.5" />
              {loading ? 'Déconnexion...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <aside
        className={`fixed bottom-0 left-0 top-14 z-30 ${sidebarWidthClass} border-r border-[#edebe9] bg-white transition-all`}
      >
        <nav className="p-2">
          {adminMainMenu.map((item) => {
            const Icon = item.icon
            const isActive = item.to === '/admin' ? isDashboardActive : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`mb-1 flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition ${
                  isActive
                    ? 'border-l-[#0078D4] bg-[#f3f2f1] font-semibold text-[#0078D4]'
                    : 'border-l-transparent text-[#323130] hover:bg-[#f3f2f1]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed ? <span>{item.label}</span> : null}
              </NavLink>
            )
          })}
        </nav>
      </aside>

      <main className={`pt-14 ${mainPaddingClass} transition-all`}>
        <div className="min-h-[calc(100vh-56px)] bg-[#f3f2f1] p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}