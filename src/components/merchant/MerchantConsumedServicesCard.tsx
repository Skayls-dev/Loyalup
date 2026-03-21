import { useEffect, useMemo, useState } from 'react'
import {
  getProviderConsumedServices,
  getProviderTopClientsByService,
  type ProviderConsumedService,
  type ProviderServiceTopClient,
} from '../../modules/providers/services/providerService'

type MerchantConsumedServicesCardProps = {
  merchantId: string
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

export function MerchantConsumedServicesCard({ merchantId }: MerchantConsumedServicesCardProps) {
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const [services, setServices] = useState<ProviderConsumedService[]>([])
  const [topClients, setTopClients] = useState<ProviderServiceTopClient[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingClients, setLoadingClients] = useState(true)

  const periodDays = period === 'all' ? null : period

  const selectedService = useMemo(
    () => services.find((item) => (item.service_id ?? null) === selectedServiceId) ?? null,
    [services, selectedServiceId],
  )

  useEffect(() => {
    const loadServices = async () => {
      setLoadingServices(true)
      try {
        if (!merchantId) {
          setServices([])
          setSelectedServiceId(null)
          return
        }

        const rows = await getProviderConsumedServices(merchantId, {
          periodDays,
          limit: 6,
        })

        setServices(rows)

        const hasSelection = rows.some((item) => (item.service_id ?? null) === selectedServiceId)
        if (!hasSelection) {
          setSelectedServiceId((rows[0]?.service_id as string | null | undefined) ?? null)
        }
      } finally {
        setLoadingServices(false)
      }
    }

    void loadServices()
  }, [merchantId, periodDays, selectedServiceId])

  useEffect(() => {
    const loadTopClients = async () => {
      setLoadingClients(true)
      try {
        if (!merchantId) {
          setTopClients([])
          return
        }

        const rows = await getProviderTopClientsByService(merchantId, selectedServiceId, {
          periodDays,
          limit: 5,
        })

        setTopClients(rows)
      } finally {
        setLoadingClients(false)
      }
    }

    void loadTopClients()
  }, [merchantId, periodDays, selectedServiceId])

  const handleExportCsv = () => {
    const suffix = period === 'all' ? 'all-time' : `${period}d`
    const filename = `merchant-consumption-${suffix}.csv`

    const rows: Array<Array<string | number>> = []
    rows.push(['SECTION', 'Service', 'Transactions', 'Montant EUR', 'Points'])

    for (const service of services) {
      rows.push([
        'services',
        `${service.service_emoji} ${service.service_nom}`,
        service.transactions_count,
        service.total_amount.toFixed(2),
        service.total_points,
      ])
    }

    rows.push(['', '', '', '', ''])
    rows.push(['SECTION', 'Client', 'Email', 'Transactions', 'Montant EUR', 'Points'])

    for (const client of topClients) {
      rows.push([
        'top-clients',
        client.client_nom,
        client.client_email,
        client.transactions_count,
        client.total_amount.toFixed(2),
        client.total_points,
      ])
    }

    downloadCsv(filename, ['section', 'col_1', 'col_2', 'col_3', 'col_4', 'col_5'], rows)
  }

  if (loadingServices) {
    return <div className="h-64 animate-pulse rounded-[16px] border border-gray-200 bg-white" />
  }

  return (
    <section className="rounded-[16px] border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-dark">Produits ou services consommes</h2>
          <p className="mt-1 text-sm text-gray-600">Classement et clients principaux par service</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPeriod(option.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                  period === option.value ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={services.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune consommation sur la periode selectionnee.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            {services.map((service) => {
              const isActive = (service.service_id ?? null) === selectedServiceId
              return (
                <button
                  key={service.service_id ?? 'free-amount'}
                  type="button"
                  onClick={() => setSelectedServiceId(service.service_id ?? null)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${
                    isActive ? 'border-primary/40 bg-primary/5' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-dark">
                      {service.service_emoji} {service.service_nom}
                    </p>
                    <p className="text-xs text-gray-500">{service.transactions_count} transaction(s)</p>
                  </div>
                  <p className="text-xs font-semibold text-gray-700">{service.total_amount.toFixed(2)} EUR</p>
                  <p className="text-xs font-semibold text-accent-green">+{service.total_points} pts</p>
                </button>
              )
            })}
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Top clients</p>
            <p className="mt-1 text-sm font-semibold text-dark">
              {selectedService ? `${selectedService.service_emoji} ${selectedService.service_nom}` : 'Montant libre'}
            </p>

            {loadingClients ? (
              <div className="mt-3 h-24 animate-pulse rounded-md bg-gray-100" />
            ) : topClients.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Aucun client pour cette selection.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {topClients.map((client) => (
                  <article
                    key={client.client_id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-dark">{client.client_nom}</p>
                      <p className="truncate text-[11px] text-gray-500">{client.transactions_count} transaction(s)</p>
                    </div>
                    <p className="text-[11px] font-semibold text-gray-700">{client.total_amount.toFixed(2)} EUR</p>
                    <p className="text-[11px] font-semibold text-accent-green">+{client.total_points}</p>
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
