type MultiplierStepperProps = {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalize(value: number): number {
  return Number(value.toFixed(1))
}

export function MultiplierStepper({
  value,
  onChange,
  min = 1,
  max = 5,
  step = 0.1,
}: MultiplierStepperProps) {
  const safeValue = clamp(value, min, max)

  const update = (direction: 1 | -1) => {
    const next = clamp(normalize(safeValue + direction * step), min, max)
    onChange(next)
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white p-1">
      <button
        type="button"
        onClick={() => update(-1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition duration-200 hover:border-[#5B4FE8] hover:text-[#5B4FE8]"
        aria-label="Diminuer le multiplicateur"
      >
        −
      </button>

      <span className="min-w-[40px] text-center font-display text-sm font-extrabold" style={{ color: '#5B4FE8' }}>
        x{safeValue.toFixed(1)}
      </span>

      <button
        type="button"
        onClick={() => update(1)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-gray-700 transition duration-200 hover:border-[#5B4FE8] hover:text-[#5B4FE8]"
        aria-label="Augmenter le multiplicateur"
      >
        +
      </button>
    </div>
  )
}
