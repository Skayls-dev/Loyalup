import type { Service } from '../services/transactionService'

type ServiceSelectorProps = {
  services: Service[]
  selectedService: Service | null
  onSelect: (service: Service) => void
  density?: 'normal' | 'dense'
}

function formatPrice(value: number | null): string {
  if (value == null) {
    return ''
  }

  return `${value.toFixed(2)}€`
}

export function ServiceSelector({ services, selectedService, onSelect, density = 'normal' }: ServiceSelectorProps) {
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
    <div className="overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max snap-x snap-mandatory gap-3 pr-1">
        {sortedServices.map((service) => {
          const isSelected = selectedService?.id === service.id
          const isCustom = service.nom === 'Personnalisé'

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={`shrink-0 snap-start rounded-xl border text-left transition-all duration-200 ${
                density === 'dense' ? 'min-h-[78px] w-[116px] p-2' : 'min-h-[112px] w-[140px] p-2.5'
              } ${
                isSelected
                  ? 'border-teal-400 bg-teal-500/15 shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800'
              }`}
            >
              <p className={density === 'dense' ? 'text-lg leading-none' : 'text-xl leading-none'}>{service.emoji}</p>
              <p className={`font-semibold leading-tight text-zinc-100 ${density === 'dense' ? 'mt-1 text-xs' : 'mt-2 text-base'}`}>
                {service.nom}
              </p>
              {!isCustom && service.prix_defaut != null ? (
                <p className="mt-1 text-xs text-zinc-400">{formatPrice(service.prix_defaut)}</p>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
