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
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="pointer-events-auto bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 text-white text-center max-w-sm shadow-2xl transform animate-bounce">
        <div className="text-6xl mb-4">{emoji}</div>

        <h2 className="text-3xl font-bold mb-2">NIVEAU {newLevel}</h2>
        <p className="text-xl font-semibold mb-6">{levelName[language] ?? levelName['fr']}</p>

        {perks && perks.length > 0 && (
          <div className="bg-white/20 rounded-lg p-4 mb-4">
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
          className="mt-4 px-6 py-2 bg-white/30 hover:bg-white/40 rounded-lg text-white font-semibold transition-colors"
        >
          Fantastique!
        </button>
      </div>
    </div>
  )
}

