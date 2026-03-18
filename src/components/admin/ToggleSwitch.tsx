type ToggleSwitchProps = {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}

export function ToggleSwitch({ label, description, value, onChange }: ToggleSwitchProps) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border px-[0.9rem] py-[0.65rem]"
      style={{ backgroundColor: 'var(--g50)', borderColor: 'var(--g200)' }}
    >
      <div className="min-w-0">
        <p className="font-body text-sm font-semibold text-gray-800">{label}</p>
        {description ? <p className="mt-0.5 font-body text-xs text-gray-600">{description}</p> : null}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className="relative h-[22px] w-10 shrink-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: value ? '#5B4FE8' : '#D1D5DB' }}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
            value ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}
