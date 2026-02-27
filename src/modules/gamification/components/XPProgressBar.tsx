
interface XPProgressBarProps {
  current: number
  target: number
  percent: number
  animated?: boolean
}

export function XPProgressBar({
  current,
  target,
  percent,
  animated = true,
}: XPProgressBarProps) {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center text-sm">
        <span className="font-semibold text-gray-700">✨ XP</span>
        <span className="text-xs text-gray-500">
          {current.toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>

      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-sm">
        <div
          className={`h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full ${
            animated ? 'transition-all duration-300 ease-out' : ''
          }`}
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
          }}
        />
      </div>

      <div className="text-right text-xs font-medium text-amber-600">
        {Math.round(percent)}% vers le prochain niveau
      </div>
    </div>
  )
}

