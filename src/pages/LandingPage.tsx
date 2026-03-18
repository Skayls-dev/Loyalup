import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AfricaNetworkSection } from '../components/landing/AfricaNetworkSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { HeroSection } from '../components/landing/HeroSection'
import { Navbar } from '../components/layout/Navbar'
import { Button, Badge } from '../components/ui'
import { useScrollReveal } from '../hooks/useScrollReveal'

interface RevealSectionProps {
  children: ReactNode
  className?: string
}

function RevealSection({ children, className = '' }: RevealSectionProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>()

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out motion-reduce:transition-none ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}

function LogosBand() {
  const pills = [
    { label: 'Brussels Local', color: 'bg-primary' },
    { label: 'Africa Network', color: 'bg-accent-green' },
    { label: 'Retail Union', color: 'bg-accent-orange' },
    { label: 'Eco-Réseau', color: 'bg-accent-yellow' },
  ]

  return (
    <section className="border-y border-gray-200 bg-gray-50 py-5">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-3 px-4 sm:px-6 lg:px-8">
        {pills.map((pill) => (
          <Badge key={pill.label} variant="info" className="px-3 py-1.5 text-[11px] font-medium text-gray-700">
            <span className={`h-2 w-2 rounded-full ${pill.color}`} aria-hidden="true" />
            {pill.label}
          </Badge>
        ))}
      </div>
    </section>
  )
}

function StatsSection() {
  const stats = [
    { value: '2 400', label: 'utilisateurs' },
    { value: '180', label: 'marchands' },
    { value: '17', label: 'reseaux' },
    { value: '94%', label: 'retention' },
  ]

  return (
    <section className="bg-white py-14 sm:py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <article key={stat.label} className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-center shadow-card">
              <p className="bg-gradient-to-r from-primary to-[#8B7FF5] bg-clip-text font-display text-4xl font-extrabold text-transparent">
                {stat.value}
              </p>
              <p className="mt-2 font-body text-sm text-gray-600">{stat.label}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTASection() {
  return (
    <section className="bg-white pb-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl bg-gradient-to-r from-primary to-accent-orange p-8 text-center shadow-primary-glow sm:p-10 lg:p-12">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">Lancez votre réseau LoyalUp aujourd&apos;hui</h2>
          <p className="mt-3 font-body text-base text-white/90">
            Créez votre espace, connectez vos marchands et démarrez votre croissance fidélité en quelques minutes.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" variant="white" onClick={() => window.location.assign('/signup')}>
              Demarrer gratuitement
            </Button>
            <Link
              to="/login"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/80 px-5 font-body text-base font-medium text-white transition hover:bg-white/12"
            >
              Connexion
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
        <div className="inline-flex items-center gap-2">
          <span className="font-display text-2xl font-extrabold text-dark">LoyalUp</span>
          <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
        </div>

        <p className="font-body text-sm text-gray-500">© {new Date().getFullYear()} LoyalUp. Tous droits reserves.</p>

        <div className="flex items-center gap-5 font-body text-sm text-gray-600">
          <Link to="/" className="transition hover:text-dark">
            Confidentialite
          </Link>
          <Link to="/" className="transition hover:text-dark">
            Conditions
          </Link>
          <Link to="/" className="transition hover:text-dark">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="bg-white">
      <Navbar />

      <RevealSection>
        <HeroSection />
      </RevealSection>

      <RevealSection>
        <LogosBand />
      </RevealSection>

      <RevealSection>
        <FeaturesSection />
      </RevealSection>

      <RevealSection>
        <AfricaNetworkSection />
      </RevealSection>

      <RevealSection>
        <StatsSection />
      </RevealSection>

      <RevealSection>
        <CTASection />
      </RevealSection>

      <Footer />
    </div>
  )
}
