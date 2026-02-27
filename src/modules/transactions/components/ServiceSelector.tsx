import type { Service } from '../services/transactionService'

type ServiceSelectorProps = {
  services: Service[]
  selectedService: Service | null
  onSelect: (service: Service) => void
}

function formatPrice(value: number | null): string {
  if (value == null) {
    return ''
  }

  return `${value.toFixed(2)}€`
}

export function ServiceSelector({ services, selectedService, onSelect }: ServiceSelectorProps) {
  const sortedServices = [...services].sort((a, b) => {
    if (a.nom === 'Personnalisé') {
      return 1
    }

    if (b.nom === 'Personnalisé') {
      return -1
    }

    return a.nom.localeCompare(b.nom)
  })

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {sortedServices.map((service) => {
        const isSelected = selectedService?.id === service.id
        const isCustom = service.nom === 'Personnalisé'

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service)}
            className={`rounded-xl border p-3 text-left transition-all duration-200 ${
              isSelected
                ? 'border-teal-400 bg-teal-500/15 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800'
            }`}
          >
            <p className="text-2xl leading-none">{service.emoji}</p>
            <p className="mt-2 text-sm font-semibold text-zinc-100">{service.nom}</p>
            {!isCustom && service.prix_defaut != null ? (
              <p className="mt-1 text-xs text-zinc-400">{formatPrice(service.prix_defaut)}</p>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
