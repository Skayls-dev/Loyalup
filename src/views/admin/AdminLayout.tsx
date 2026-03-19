import { ChevronLeft, ChevronRight, LayoutGrid, LogOut, Network } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useAdminGuard } from '../../hooks/useAdminGuard'

type NavItem = { to: string; label: string; icon: typeof LayoutGrid; exact?: boolean }

const adminMainMenu: NavItem[] = [
  { to: '/admin', label: 'Vue d\'ensemble', icon: LayoutGrid, exact: true },
  { to: '/admin/networks', label: 'Réseaux', icon: Network },
]

export function AdminLayout() {
  const { logout, loading, profile } = useAuth()
  const { isAdmin, isLoading } = useAdminGuard()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const sidebarW = collapsed ? 'w-[68px]' : 'w-[240px]'
  const mainPad = collapsed ? 'lg:pl-[68px]' : 'lg:pl-[240px]'
  const displayName = profile?.nom?.trim() || profile?.email?.split('@')[0] || 'Admin'
  const role = profile?.role === 'super_admin' ? 'Super Admin' : 'Admin'

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-40 hidden flex-col bg-slate-900 transition-all duration-200 lg:flex ${sidebarW}`}
      >
        {/* Brand */}
        <div className={`flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4`}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-extrabold text-white shadow-lg shadow-violet-900/50">
            L
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">LoyalUp</p>
              <p className="truncate text-[11px] text-slate-400">Admin Portal</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 pt-3">
          {!collapsed && (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Navigation
            </p>
          )}
          {adminMainMenu.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-violet-600 text-white shadow shadow-violet-900/40'
                    : 'text-slate-400 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User card + collapse button */}
        <div className="shrink-0 border-t border-white/10 p-3 space-y-2">
          {!collapsed && (
            <div className="flex items-center gap-2 rounded-lg bg-white/6 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/30 text-xs font-bold text-violet-300">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{displayName}</p>
                <p className="truncate text-[10px] text-slate-400">{role}</p>
              </div>
              <button
                type="button"
                onClick={() => logout().catch(() => undefined)}
                disabled={loading}
                title="Se déconnecter"
                className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-rose-400 disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-500 transition hover:bg-white/8 hover:text-slate-300"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Réduire</span></>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────── */}
      <main className={`transition-all duration-200 ${mainPad}`}>
        <div className="min-h-screen p-4 pb-28 lg:p-8 lg:pb-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-700 bg-slate-900/95 backdrop-blur lg:hidden" aria-label="Navigation mobile admin">
        <div className="grid grid-cols-3 px-2 py-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          {adminMainMenu.map((item) => {
            const Icon = item.icon
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to)

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition ${
                  isActive ? 'text-violet-300' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-violet-300' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => logout().catch(() => undefined)}
            disabled={loading}
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-slate-400 transition hover:text-rose-300 disabled:opacity-60"
          >
            <LogOut className="h-4.5 w-4.5" />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </div>
  )
}