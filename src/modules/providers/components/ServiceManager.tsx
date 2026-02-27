import { Suspense, lazy, useState } from 'react'
import { useServiceManager } from '../hooks/useServiceManager'
import type { ServiceItem } from '../services/providerService'

const ServiceForm = lazy(() => import('./ServiceForm').then((module) => ({ default: module.ServiceForm })))

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

export function ServiceManager() {
  const { services, loading, createItem, updateItem, toggleItem } = useServiceManager()
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [openCreate, setOpenCreate] = useState(false)

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Services</h3>
        <button type="button" onClick={() => setOpenCreate(true)} className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900">
          Ajouter un service
        </button>
      </div>

      {loading ? <p className="text-xs text-zinc-500">Chargement...</p> : null}

      <div className="space-y-2">
        {services.map((service) => (
          <article key={service.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            <div>
              <p className="text-sm text-zinc-100">{service.emoji} {service.nom}</p>
              <p className="text-xs text-zinc-500">
                {service.prix_defaut !== null ? `${service.prix_defaut} €` : 'Prix libre'} • {service.points_defaut ?? '-'} pts • {service.points_per_euro} pts/€
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleItem(service.id, !service.actif).catch(() => null)
                }}
                className={`rounded-md px-2 py-1 text-xs ${service.actif ? 'bg-emerald-900/60 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}`}
              >
                {service.actif ? 'Actif' : 'Inactif'}
              </button>
              <button type="button" onClick={() => setEditing(service)} className={secondaryButtonClass}>Edit</button>
            </div>
          </article>
        ))}
      </div>

      {openCreate ? (
        <Suspense fallback={null}>
          <ServiceForm
            onSubmit={async (data) => {
              await createItem(data)
            }}
            onCancel={() => setOpenCreate(false)}
          />
        </Suspense>
      ) : null}

      {editing ? (
        <Suspense fallback={null}>
          <ServiceForm
            initialData={editing}
            onSubmit={async (data) => {
              await updateItem(editing.id, data)
            }}
            onCancel={() => setEditing(null)}
          />
        </Suspense>
      ) : null}
    </section>
  )
}
