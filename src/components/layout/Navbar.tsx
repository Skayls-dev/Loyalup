import { useState } from 'react'
import { Link } from 'react-router-dom'

interface NavbarLink {
  label: string
  href: string
}

const navLinks: NavbarLink[] = [
  { label: 'Reseaux', href: '#reseaux' },
  { label: 'Marchands', href: '#marchands' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Tarifs', href: '#tarifs' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const closeMobile = () => {
    setMobileOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-gray-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="inline-flex items-center gap-2" onClick={closeMobile}>
          <span className="font-display text-2xl font-extrabold text-dark">Looyaal</span>
          <span className="relative inline-flex h-3 w-3" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/55" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="font-body text-sm font-medium text-gray-600 transition hover:text-dark"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border border-transparent px-4 font-body text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Connexion
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 font-body text-sm font-medium text-white shadow-primary-glow transition hover:brightness-105"
          >
            Demarrer gratuitement
          </Link>
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((prev) => !prev)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-gray-700 transition hover:bg-gray-100 md:hidden"
        >
          <span className="sr-only">Menu</span>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {mobileOpen ? (
              <path d="M18 6 6 18M6 6l12 12" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      <div
        className={`md:hidden overflow-hidden border-b border-gray-200 bg-white shadow-floating transition-all duration-300 ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="space-y-1 px-4 py-4 sm:px-6">
          {navLinks.map((item) => (
            <a
              key={`mobile-${item.label}`}
              href={item.href}
              onClick={closeMobile}
              className="block rounded-md px-3 py-2 font-body text-sm font-medium text-gray-700 transition hover:bg-gray-100 hover:text-dark"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-3 flex flex-col gap-2 border-t border-gray-200 pt-3">
            <Link
              to="/login"
              onClick={closeMobile}
              className="inline-flex h-10 items-center justify-center rounded-md border border-transparent font-body text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              Connexion
            </Link>
            <Link
              to="/signup"
              onClick={closeMobile}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary font-body text-sm font-medium text-white shadow-primary-glow transition hover:brightness-105"
            >
              Demarrer gratuitement
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}
