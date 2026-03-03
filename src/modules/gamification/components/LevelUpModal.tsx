import { useEffect } from 'react'

interface LevelUpModalProps {
  isOpen: boolean
  onClose: () => void
  newLevel: number
  emoji: string
  levelName: Record<string, string>
  perks: Array<{
    description: Record<string, string>
    type: string
    value: number
  }>
  language?: string
}

export function LevelUpModal({
  isOpen,
  onClose,
  newLevel,
  emoji,
  levelName,
  perks,
  language = 'fr',
}: LevelUpModalProps) {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 4000)
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 pointer-events-none backdrop-blur-sm">
      <div className="pointer-events-auto max-w-sm transform rounded-2xl border border-white/70 bg-white/95 p-8 text-center text-slate-900 shadow-2xl animate-bounce">
        <div className="text-6xl mb-4">{emoji}</div>

        <h2 className="text-3xl font-bold mb-2">NIVEAU {newLevel}</h2>
        <p className="text-xl font-semibold mb-6">{levelName[language] ?? levelName['fr']}</p>

        {perks && perks.length > 0 && (
          <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/80 p-4">
            <p className="text-sm font-semibold mb-3">✨ Nouveaux avantages</p>
            <ul className="text-sm space-y-2 text-left">
              {perks.map((perk, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">→</span>
                  <span>{perk.description[language] ?? perk.description['fr']}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-indigo-500"
        >
          Fantastique!
        </button>
      </div>
    </div>
  )
}

