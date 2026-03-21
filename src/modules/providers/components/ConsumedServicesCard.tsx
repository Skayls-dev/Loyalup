import { useEffect, useMemo, useState } from 'react'
import {
  getProviderConsumedServices,
  type ProviderConsumedService,
  getProviderTopClientsByService,
  type ProviderServiceTopClient,
} from '../services/providerService'

type ConsumedServicesCardProps = {
  fournisseur_id: string | null
}

type PeriodFilter = 7 | 30 | 90 | 'all'

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: 7, label: '7j' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 'all', label: 'Tout' },
]

function formatCsvCell(value: string | number): string {
  const text = String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [
    headers.map((header) => formatCsvCell(header)).join(','),
    ...rows.map((row) => row.map((cell) => formatCsvCell(cell)).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export function ConsumedServicesCard({ fournisseur_id }: ConsumedServicesCardProps) {
  const [items, setItems] = useState<ProviderConsumedService[]>([])
  const [clients, setClients] = useState<ProviderServiceTopClient[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingClients, setLoadingClients] = useState(true)
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const periodDays = period === 'all' ? null : period

  const selectedService = useMemo(
    () => items.find((item) => (item.service_id ?? null) === selectedServiceId) ?? null,
    [items, selectedServiceId],
  )

  useEffect(() => {
    const load = async () => {
      setLoadingServices(true)

      try {
        if (!fournisseur_id) {
          setItems([])
          setSelectedServiceId(null)
          return
        }

        const rows = await getProviderConsumedServices(fournisseur_id, {
          limit: 6,
          periodDays,
        })
        setItems(rows)

        const hasCurrentSelection = rows.some((item) => (item.service_id ?? null) === selectedServiceId)
        if (!hasCurrentSelection) {
          setSelectedServiceId((rows[0]?.service_id as string | null | undefined) ?? null)
        }
      } finally {
        setLoadingServices(false)
      }
    }

    void load()
  }, [fournisseur_id, periodDays, selectedServiceId])

  useEffect(() => {
    const loadClients = async () => {
      setLoadingClients(true)

      try {
        if (!fournisseur_id) {
          setClients([])
          return
        }

        const rows = await getProviderTopClientsByService(fournisseur_id, selectedServiceId, {
          limit: 5,
          periodDays,
        })
        setClients(rows)
      } finally {
        setLoadingClients(false)
      }
    }

    void loadClients()
  }, [fournisseur_id, selectedServiceId, periodDays])

  if (loadingServices) {
    return <div className="h-52 animate-pulse rounded-xl bg-zinc-800/70" />
  }

  const handleExport = () => {
    const suffix = period === 'all' ? 'all-time' : `${period}d`
    const filename = `provider-consumption-${suffix}.csv`

    const rows: Array<Array<string | number>> = []

    rows.push(['SECTION', 'Service', 'Transactions', 'Montant EUR', 'Points'])
    for (const item of items) {
      rows.push([
        'services',
        `${item.service_emoji} ${item.service_nom}`,
        item.transactions_count,
        item.total_amount.toFixed(2),
        item.total_points,
      ])
    }

    rows.push([])
    rows.push(['SECTION', 'Client', 'Email', 'Transactions', 'Montant EUR', 'Points'])
    for (const client of clients) {
      rows.push([
        'top-clients',
        client.client_nom,
        client.client_email,
        client.transactions_count,
        client.total_amount.toFixed(2),
        client.total_points,
      ])
    }

    downloadCsv(
      filename,
      ['section', 'col_1', 'col_2', 'col_3', 'col_4', 'col_5'],
      rows.map((row) => (row.length === 0 ? ['', '', '', '', '', ''] : row)),
    )
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Services consommes</h3>
          <p className="text-xs text-zinc-500">Top 6 + clients principaux par service</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-950/70 p-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  period === option.value
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={items.length === 0}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucune consommation enregistree sur la periode selectionnee.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            {items.map((item) => {
              const isActive = (item.service_id ?? null) === selectedServiceId
              return (
                <button
                  key={item.service_id ?? 'free-amount'}
                  type="button"
                  onClick={() => setSelectedServiceId(item.service_id ?? null)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-zinc-500 bg-zinc-800/70'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {item.service_emoji} {item.service_nom}
                    </p>
                    <p className="text-xs text-zinc-500">{item.transactions_count} transaction(s)</p>
                  </div>

                  <p className="text-xs font-semibold text-zinc-300">{item.total_amount.toFixed(2)} €</p>
                  <p className="text-xs font-semibold text-emerald-400">+{item.total_points} pts</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Top clients</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">
              {selectedService ? `${selectedService.service_emoji} ${selectedService.service_nom}` : 'Montant libre'}
            </p>

            {loadingClients ? (
              <div className="mt-3 h-24 animate-pulse rounded-md bg-zinc-800/70" />
            ) : clients.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">Aucun client pour cette selection.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {clients.map((client) => (
                  <article
                    key={client.client_id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-zinc-200">{client.client_nom}</p>
                      <p className="truncate text-[11px] text-zinc-500">{client.transactions_count} transaction(s)</p>
                    </div>
                    <p className="text-[11px] font-semibold text-zinc-300">{client.total_amount.toFixed(2)} €</p>
                    <p className="text-[11px] font-semibold text-emerald-400">+{client.total_points}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
