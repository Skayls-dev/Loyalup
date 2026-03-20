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
  const badgeName = badge.name[language] ?? badge.name.fr ?? badge.name.en ?? badge.code
  const unlockedAtLabel = badge.unlocked_at
    ? new Date(badge.unlocked_at).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
    : null

  return (
    <div
      className={`group relative flex min-h-[178px] w-full flex-col rounded-2xl border-2 p-3 transition-all duration-200 ${
        rarityBorders[rarityKey] ?? rarityBorders.common
      } ${earned ? `bg-gradient-to-br ${rarityColors[rarityKey]} text-white shadow-sm` : 'bg-slate-100 text-slate-700'} ${locked ? 'opacity-80' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${earned ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
          {badge.rarity ?? 'common'}
        </span>
        {locked && !earned ? <span className="text-base" aria-hidden="true">🔒</span> : null}
      </div>

      <div className={`mb-2 flex h-14 items-center justify-center text-4xl ${earned ? '' : 'opacity-70'}`}>
        {badge.emoji || '🏅'}
      </div>

      <p className={`line-clamp-2 min-h-[38px] text-center text-sm font-semibold leading-tight ${earned ? 'text-white' : 'text-slate-800'}`}>
        {badgeName}
      </p>

      <p className={`mt-1 text-center text-[11px] uppercase tracking-wide ${earned ? 'text-white/80' : 'text-slate-500'}`}>
        {badge.category || 'badge'}
      </p>

      <div className="mt-auto pt-2 text-center text-[11px]">
        {earned && unlockedAtLabel ? (
          <span className="rounded-full bg-white/20 px-2 py-0.5">{language === 'fr' ? `Débloqué ${unlockedAtLabel}` : `Unlocked ${unlockedAtLabel}`}</span>
        ) : locked ? (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{language === 'fr' ? 'À débloquer' : 'Locked'}</span>
        ) : null}
      </div>

      {earned && badge.rarity === 'legendary' && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-70" />
      )}
    </div>
  )
}

