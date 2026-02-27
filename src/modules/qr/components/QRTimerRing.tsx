type QRTimerRingProps = {
  secondsLeft: number
  total?: number
}

const RADIUS = 64
const STROKE = 10
const NORMALIZED_RADIUS = RADIUS - STROKE / 2
const CIRCUMFERENCE = 2 * Math.PI * NORMALIZED_RADIUS

function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, seconds)
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

function getColor(secondsLeft: number): string {
  if (secondsLeft > 60) {
    return '#14b8a6'
  }

  if (secondsLeft >= 30) {
    return '#f59e0b'
  }

  return '#ef4444'
}

export function QRTimerRing({ secondsLeft, total = 180 }: QRTimerRingProps) {
  const progress = Math.max(0, Math.min(1, secondsLeft / total))
  const dashOffset = CIRCUMFERENCE * (1 - progress)
  const strokeColor = getColor(secondsLeft)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={RADIUS * 2} height={RADIUS * 2} className="-rotate-90">
        <circle
          cx={RADIUS}
          cy={RADIUS}
          r={NORMALIZED_RADIUS}
          stroke="#3f3f46"
          strokeWidth={STROKE}
          fill="transparent"
        />
        <circle
          cx={RADIUS}
          cy={RADIUS}
          r={NORMALIZED_RADIUS}
          stroke={strokeColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="transparent"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.8s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span className="absolute text-lg font-semibold text-zinc-100">{formatTimer(secondsLeft)}</span>
    </div>
  )
}
