import { Outlet } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { MainMenu } from '../../shared/components/MainMenu'

const adminMainMenu = [
  { to: '/admin', label: 'Dashboard admin' },
  { to: '/admin/network', label: 'Réseaux' },
]

export function AdminLayout() {
  const { logout, loading, profile } = useAuth()

  return (
    <div className="min-h-screen bg-[#061224] text-[#F5FAFF]">
      <header className="sticky top-0 z-20 border-b border-[rgba(80,176,255,0.25)] bg-[#061224]">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-gradient-to-br from-[#106EBE] to-[#50B0FF] text-center text-sm font-bold leading-8 text-white shadow-sm">
              L
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Administration</p>
              <p className="text-xs text-[#8FBCE6]">{profile?.email ?? 'admin@loyalup.test'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MainMenu items={adminMainMenu} />
            <button
              type="button"
              onClick={() => {
                logout().catch(() => undefined)
              }}
              disabled={loading}
              className="rounded-xl border border-[rgba(80,176,255,0.35)] bg-[#0D3A66] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#106EBE] disabled:opacity-70"
            >
              {loading ? 'Déconnexion...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl p-6">
        <Outlet />
      </main>
    </div>
  )
}