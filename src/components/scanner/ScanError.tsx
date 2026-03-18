import { useEffect, useMemo, useState } from 'react'

export type ScanErrorReason = 'expired' | 'invalid' | 'network_mismatch' | 'already_scanned'

export interface ScanErrorProps {
  reason: ScanErrorReason
  onReset: () => void
}

type ErrorContent = {
  title: string
  message: string
  tips: string[]
}

const ERROR_CONTENT: Record<ScanErrorReason, ErrorContent> = {
  expired: {
    title: 'QR code expiré',
    message: 'Ce QR code a dépassé sa durée de validité (24h).',
    tips: [
      'Demandez au marchand de générer un nouveau QR.',
      'Vérifiez la date et l heure de votre appareil.',
      'Rechargez la page scanner puis recommencez.',
    ],
  },
  invalid: {
    title: 'QR code invalide',
    message: "Ce QR code n'est pas reconnu par LoyalUp.",
    tips: [
      'Assurez-vous de scanner un QR officiel LoyalUp.',
      'Nettoyez la caméra et essayez sous un meilleur éclairage.',
      'Utilisez la saisie manuelle du code si nécessaire.',
    ],
  },
  network_mismatch: {
    title: 'Réseau incompatible',
    message: "Ce marchand n'appartient pas à vos réseaux actifs.",
    tips: [
      'Vérifiez vos réseaux actifs dans votre profil.',
      'Demandez au marchand dans quel réseau il opère.',
      'Contactez le support si vous pensez être éligible.',
    ],
  },
  already_scanned: {
    title: 'Déjà scanné',
    message: "Ce QR code a déjà été utilisé aujourd'hui.",
    tips: [
      'Un seul scan est autorisé pour ce marchand aujourd hui.',
      'Réessayez plus tard avec un nouveau passage en caisse.',
      'Consultez votre historique pour confirmer le dernier scan.',
    ],
  },
}

export function ScanError({ reason, onReset }: ScanErrorProps) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setEntered(true), 20)
    return () => {
      window.clearTimeout(timer)
    }
  }, [])

  const content = useMemo(() => ERROR_CONTENT[reason], [reason])

  return (
    <section className="flex justify-center">
      <article
        className={`w-full max-w-[420px] rounded-[24px] border border-rose-200 bg-white p-5 shadow-[0_10px_30px_rgba(127,29,29,0.08)] transition-all duration-[350ms] ${
          entered ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        <div className="flex justify-center">
          <div className="error-pop inline-flex h-[72px] w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-[#E24B4A] to-[#A32D2D] text-4xl text-white shadow-[0_12px_28px_rgba(162,45,45,0.35)]">
            ✕
          </div>
        </div>

        <div className="mt-4 text-center">
          <h3 className="font-display text-2xl font-extrabold text-[#8E2323]">{content.title}</h3>
          <p className="mt-1 font-body text-sm text-[#7A2A2A]">{content.message}</p>
        </div>

        <div className="mt-4 rounded-[8px] bg-[#FCEBEB] p-3 text-[#791F1F]">
          <p className="font-body text-xs font-semibold uppercase tracking-[0.12em]">Conseils</p>
          <ul className="mt-2 space-y-1.5">
            {content.tips.map((tip) => (
              <li key={tip} className="font-body text-sm">
                • {tip}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onReset}
            className="h-11 rounded-md border border-gray-300 bg-transparent font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ↩ Réessayer
          </button>
          <a
            href="mailto:support@loyalup.app?subject=Assistance%20scan%20QR"
            className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-transparent font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Contacter le support
          </a>
        </div>

        <style>{`
          .error-pop {
            animation: error-pop-in 520ms cubic-bezier(0.17, 0.89, 0.32, 1.35) both;
          }

          @keyframes error-pop-in {
            0% {
              transform: scale(0.65);
              opacity: 0;
            }
            100% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </article>
    </section>
  )
}
