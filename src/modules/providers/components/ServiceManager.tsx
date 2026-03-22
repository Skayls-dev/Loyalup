import { Suspense, lazy, useState } from 'react'
import { useServiceManager } from '../hooks/useServiceManager'
import type { ServiceItem } from '../services/providerService'

const ServiceForm = lazy(() => import('./ServiceForm').then((module) => ({ default: module.ServiceForm })))

const softButtonClass =
  'rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'

export function ServiceManager() {
  const { services, loading, createItem, updateItem, toggleItem } = useServiceManager()
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [openCreate, setOpenCreate] = useState(false)

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-xl font-extrabold text-dark">Services</h3>
          <p className="mt-1 font-body text-xs text-gray-500">Produits et prestations vendus en caisse.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="rounded-lg bg-[#FF6B35] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105"
        >
          Ajouter un service
        </button>
      </div>

      {loading ? <p className="text-xs text-gray-500">Chargement...</p> : null}

      <div className="space-y-2">
        {services.map((service) => (
          <article
            key={service.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 transition hover:-translate-y-[1px] hover:border-[#FF6B35]/40"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-semibold text-dark">{service.emoji} {service.nom}</p>
              <p className="truncate text-xs text-gray-500">
                {service.prix_defaut !== null ? `${service.prix_defaut} €` : 'Prix libre'} • {service.points_defaut ?? '-'} pts • {service.points_per_euro} pts/€
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleItem(service.id, !service.actif).catch(() => null)
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${service.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {service.actif ? 'Actif' : 'Inactif'}
              </button>
              <button type="button" onClick={() => setEditing(service)} className={softButtonClass}>Editer</button>
            </div>
          </article>
        ))}

        {!loading && services.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <p className="font-body text-sm font-semibold text-gray-700">Aucun service pour le moment</p>
            <p className="mt-1 text-xs text-gray-500">Ajoutez un service pour alimenter votre catalogue.</p>
          </div>
        ) : null}
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
