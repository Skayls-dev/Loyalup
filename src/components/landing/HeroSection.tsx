import { useState } from 'react'
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

type DemoStep = 'scan' | 'validation' | 'reward'
type DemoView = 'interactive' | 'video'

const demoVideoSrc = '/ads/looyaal-demo.mp4'

const demoStepContent: Record<DemoStep, { title: string; body: string; metric: string; accent: string }> = {
  scan: {
    title: '1. Scan instantane',
    body: 'Un client scanne le QR. La caisse detecte le profil et les offres disponibles en temps reel.',
    metric: 'Temps moyen: 1.2 s',
    accent: 'bg-sky-100 text-sky-700',
  },
  validation: {
    title: '2. Validation caisse',
    body: 'Le commercant valide la transaction et applique un bonus reseau selon la campagne active.',
    metric: '+34% retours clients',
    accent: 'bg-violet-100 text-violet-700',
  },
  reward: {
    title: '3. Points credites',
    body: 'Le client voit ses points credites et sa prochaine recompense, sans attente ni ticket papier.',
    metric: '+250 pts bienvenue',
    accent: 'bg-emerald-100 text-emerald-700',
  },
}

export function HeroSection() {
  const navigate = useNavigate()
  const [demoOpen, setDemoOpen] = useState(false)
  const [demoStep, setDemoStep] = useState<DemoStep>('scan')
  const [demoView, setDemoView] = useState<DemoView>('interactive')
  const [videoUnavailable, setVideoUnavailable] = useState(false)

  const activeDemo = demoStepContent[demoStep]

  return (
    <>
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
              <Button
                size="lg"
                variant="ghost"
                onClick={() => {
                  setDemoView('interactive')
                  setVideoUnavailable(false)
                  setDemoOpen(true)
                }}
              >
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

                  <div className="mt-3 grid grid-cols-2 gap-3">
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

      {demoOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-violet-100 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.35)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-violet-500">
                  {demoView === 'interactive' ? 'Demo interactive (donnees fictives)' : 'Demo video (sandbox)'}
                </p>
                <h3 className="mt-1 font-display text-2xl font-extrabold text-dark">Experience Looyaal en 30 secondes</h3>
              </div>
              <button
                type="button"
                onClick={() => setDemoOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
                aria-label="Fermer la demo"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 inline-flex rounded-xl bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setDemoView('interactive')}
                className={`rounded-lg px-3 py-1.5 font-body text-xs font-semibold transition ${
                  demoView === 'interactive' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Interactive
              </button>
              <button
                type="button"
                onClick={() => setDemoView('video')}
                className={`rounded-lg px-3 py-1.5 font-body text-xs font-semibold transition ${
                  demoView === 'video' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                Video
              </button>
            </div>

            {demoView === 'interactive' ? (
              <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                  <button
                    type="button"
                    onClick={() => setDemoStep('scan')}
                    className={`w-full rounded-xl px-3 py-2 text-left font-body text-sm font-semibold transition ${
                      demoStep === 'scan' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Scanner le QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoStep('validation')}
                    className={`w-full rounded-xl px-3 py-2 text-left font-body text-sm font-semibold transition ${
                      demoStep === 'validation' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Valider en caisse
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoStep('reward')}
                    className={`w-full rounded-xl px-3 py-2 text-left font-body text-sm font-semibold transition ${
                      demoStep === 'reward' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-600 hover:bg-white'
                    }`}
                  >
                    Crediter les points
                  </button>
                </div>

                <article className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-lg font-extrabold text-dark">{activeDemo.title}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${activeDemo.accent}`}>
                      {activeDemo.metric}
                    </span>
                  </div>

                  <p className="mt-2 font-body text-sm text-gray-600">{activeDemo.body}</p>

                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        <QRCodeSVG value="looyaal-interactive-demo" size={82} includeMargin />
                      </div>
                      <div className="min-w-0">
                        <p className="font-body text-xs uppercase tracking-[0.12em] text-gray-500">Client demo</p>
                        <p className="mt-1 font-body text-sm font-semibold text-gray-900">Awa • Brussels Local</p>
                        <p className="mt-1 font-body text-xs text-gray-500">Solde fictif: 1 120 pts · Prochaine recompense: 1 300 pts</p>
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-3">
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    className="h-auto w-full"
                    poster="/ads/demo-poster.webp"
                    onError={() => setVideoUnavailable(true)}
                  >
                    <source src={demoVideoSrc} type="video/mp4" />
                    Votre navigateur ne prend pas en charge la lecture video.
                  </video>
                </div>
                {videoUnavailable ? (
                  <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-body text-xs text-amber-800">
                    Video de demo indisponible pour le moment. L&apos;onglet Interactive reste disponible avec des donnees fictives.
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-xs text-gray-500">Aucune donnee reelle n&apos;est utilisee dans cette simulation.</p>
              <div className="flex items-center gap-2">
                <Button size="md" variant="ghost" onClick={() => setDemoOpen(false)}>
                  Fermer
                </Button>
                <Button size="md" variant="primary" onClick={() => navigate('/onboarding/1')}>
                  Tester l'onboarding
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
