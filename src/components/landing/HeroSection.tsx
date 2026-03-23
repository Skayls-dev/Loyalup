import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Badge, Button } from '../ui'

interface NetworkPill {
  label: string
}

const networkPills: NetworkPill[] = [
  { label: 'Global Network' },
  { label: 'Brussels Local' },
  { label: 'Eco-Reseau' },
]

const avatars = ['AK', 'BL', 'CM', 'DN']
const demoQrValue = 'looyaal-demo-qr-provider-2'

export function HeroSection() {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden bg-gray-50 py-12 sm:py-16 lg:py-20">
      <div className="absolute inset-x-0 top-0 -z-0 h-56 bg-gradient-to-b from-primary-light/70 to-transparent" aria-hidden="true" />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
        <div>
          <Badge variant="default" dot className="px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]">
            Fidelite multi-reseaux · Nouvelle generation
          </Badge>

          <h1 className="mt-5 font-display text-4xl font-extrabold leading-tight text-dark sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
            Activez la fidelite sur
            <span className="block bg-gradient-to-r from-primary to-[#8B7FF5] bg-clip-text text-transparent">
              tous vos reseaux
            </span>
          </h1>

          <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-gray-600 sm:text-lg">
            Looyaal connecte vos marchands, vos clients et vos coalitions dans une experience de points fluide, visible et rentable.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button size="lg" variant="primary" onClick={() => navigate('/signup')}>
              Demarrer gratuitement
            </Button>
            <Button size="lg" variant="ghost" onClick={() => navigate('/login')}>
              Voir la demo
            </Button>
          </div>

          <div className="mt-7 flex items-center gap-4">
            <div className="flex -space-x-3">
              {avatars.map((avatar, index) => (
                <div
                  key={avatar}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-primary-light to-white font-body text-[11px] font-semibold text-primary shadow-floating"
                  style={{ zIndex: avatars.length - index }}
                >
                  {avatar}
                </div>
              ))}
            </div>
            <p className="font-body text-sm text-gray-600">
              <span className="font-semibold text-dark">2 400 utilisateurs actifs</span> ce mois-ci
            </p>
          </div>
        </div>

        <div className="relative">
          <article className="mx-auto w-full max-w-[620px]">
            <div className="relative rounded-[34px] border border-[#D8E1F5] bg-gradient-to-b from-white to-[#EEF3FF] p-3 shadow-[0_34px_54px_rgba(16,24,40,0.22)]">
              <div className="pointer-events-none absolute inset-x-12 -bottom-5 h-10 rounded-full bg-primary/20 blur-2xl" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-x-16 bottom-0 h-16 rounded-full bg-white/70 blur-xl" aria-hidden="true" />

              <div className="relative rounded-2xl border border-[#253356] bg-[#050C1E]/95 p-3 text-white shadow-[0_20px_36px_rgba(2,6,23,0.6)] sm:p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-[0.2em] text-[#8D9DC8]">Affichage caisse</p>
                    <p className="mt-1 font-body text-xs text-[#D7DFFD]">QR dynamique et campagne active.</p>
                  </div>
                  <p className="rounded-full border border-[#2A3A63] bg-[#0E1935] px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-[#A5B7E9]">
                    Publicite
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-[1.15fr_0.85fr] gap-3">
                  <div className="rounded-xl bg-white p-2.5">
                    <QRCodeSVG value={demoQrValue} size={112} includeMargin className="h-auto w-full" />
                    <p className="mt-1.5 text-center font-body text-[10px] font-semibold tracking-[0.22em] text-[#0F172A]">284 701</p>
                  </div>

                  <div className="rounded-xl border border-[#2A5A4A] bg-gradient-to-br from-[#113326] to-[#0C221A] p-2.5">
                    <p className="font-body text-[9px] uppercase tracking-[0.16em] text-[#9CE5CC]">Looyaal Premium</p>
                    <p className="mt-1 font-body text-xs font-semibold text-[#E6FFF5]">+34% retours clients</p>
                    <p className="mt-1 font-body text-[10px] text-[#BEEEDC]">Activez une offre flash pendant l&apos;attente du scan.</p>
                    <button type="button" className="mt-2 rounded-md bg-[#24CB95] px-2 py-1 font-body text-[10px] font-semibold text-[#04281B]">
                      Activer
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="font-body text-[11px] text-[#AEBDE4]">En attente de scan...</p>
                  <div className="hidden items-center gap-1 sm:flex">
                    {networkPills.slice(0, 2).map((pill) => (
                      <Badge key={pill.label} variant="info" className="border-primary/30 bg-primary-light/10 px-2 py-0.5 text-[9px] text-[#7CA7FF]">
                        {pill.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </article>

          <div className="absolute -right-2 -top-4 inline-flex animate-float-card items-center rounded-full border border-primary/20 bg-primary-light px-3 py-2 text-xs font-body font-medium text-primary shadow-floating">
            Simulation tablette fournisseur
          </div>
        </div>
      </div>
    </section>
  )
}
