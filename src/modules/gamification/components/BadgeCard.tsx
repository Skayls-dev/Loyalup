import type { BadgeData } from '../services/gamificationService'

interface BadgeCardProps {
  badge: BadgeData
  earned: boolean
  locked?: boolean
  language?: string
}

const rarityColors = {
  common: 'from-gray-400 to-gray-500',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-500 to-purple-700',
  legendary: 'from-yellow-400 to-orange-600',
}

const rarityBorders = {
  common: 'border-gray-400',
  rare: 'border-blue-500',
  epic: 'border-purple-600',
  legendary: 'border-yellow-500',
}

export function BadgeCard({
  badge,
  earned,
  locked = false,
  language = 'fr',
}: BadgeCardProps) {
  const rarityKey = (badge.rarity ?? 'common') as keyof typeof rarityColors

  return (
    <div
      className={`relative w-24 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition-transform hover:scale-105 cursor-pointer ${
        rarityBorders[rarityKey] ?? rarityBorders.common
      } ${earned ? `bg-gradient-to-br ${rarityColors[rarityKey]}` : 'bg-gray-300'}`}
    >
      {/* Locked overlay */}
      {locked && !earned && (
        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
      )}

      {/* Badge emoji/content */}
      <div className={`text-3xl ${earned ? '' : 'opacity-50'}`}>
        {badge.emoji || '🏅'}
      </div>

      {/* Shimmer effect for legendary */}
      {earned && badge.rarity === 'legendary' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-lg animate-pulse" />
      )}

      {/* Badge name (small, on hover or below) */}
      <div className="absolute -bottom-8 left-0 right-0 text-center text-xs font-bold text-gray-700 truncate px-1 pointer-events-none">
        {badge.name[language] ?? badge.code}
      </div>
    </div>
  )
}

