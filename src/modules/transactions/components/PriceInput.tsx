import { useEffect, useRef } from 'react'
import type { Service } from '../services/transactionService'

type PriceInputProps = {
  montant: string
  onMontantChange: (value: string) => void
  pointsPreview: number
  selectedService: Service | null
}

export function PriceInput({
  montant,
  onMontantChange,
  pointsPreview,
  selectedService,
}: PriceInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <label htmlFor="montant" className="mb-2 block text-sm font-medium text-zinc-300">
        Montant (€)
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id="montant"
          type="text"
          inputMode="decimal"
          value={montant}
          onChange={(event) => onMontantChange(event.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 pr-10 text-2xl font-semibold text-zinc-100 outline-none transition focus:border-teal-400"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400">
          €
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <p className="text-sm text-zinc-400">1€ = 10 pts</p>

        {selectedService?.points_defaut != null ? (
          <p className="text-sm text-zinc-300">Points fixes: {selectedService.points_defaut}</p>
        ) : null}

        <p className="text-2xl font-bold text-amber-400 transition-all duration-200">
          {pointsPreview} pts
        </p>
      </div>
    </div>
  )
}
