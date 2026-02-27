
interface LevelBadgeProps {
  level: number
  emoji: string
  color: string
  size?: 'sm' | 'md' | 'lg'
}

export function LevelBadge({ level, emoji, color, size = 'md' }: LevelBadgeProps) {
  const sizeClasses = {
    sm: 'w-12 h-12 text-lg',
    md: 'w-16 h-16 text-2xl',
    lg: 'w-24 h-24 text-4xl',
  }

  const borderClasses = {
    sm: 'border-2',
    md: 'border-4',
    lg: 'border-6',
  }

  return (
    <div
      className={`${sizeClasses[size]} ${borderClasses[size]} rounded-full flex items-center justify-center font-bold`}
      style={{
        backgroundColor: color,
        borderColor: color,
        opacity: 0.9,
      }}
    >
      <span>{emoji}</span>
      <span className="absolute text-xs font-bold" style={{ color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
        {level}
      </span>
    </div>
  )
}

