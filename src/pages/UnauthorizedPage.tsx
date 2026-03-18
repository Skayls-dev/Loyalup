import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 text-center shadow-[0_20px_50px_-30px_rgba(226,75,74,0.5)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">403</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Accès non autorisé</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Cette section est réservée aux comptes super_admin.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/"
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800"
          >
            Retour accueil
          </Link>
          <Link
            to="/admin/auth"
            className="rounded-xl bg-[#E24B4A] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105"
          >
            Connexion admin
          </Link>
        </div>
      </div>
    </div>
  )
}
