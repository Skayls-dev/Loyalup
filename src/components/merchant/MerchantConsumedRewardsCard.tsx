import { useEffect, useState } from 'react'
import {
  getProviderConsumedRewards,
  type ProviderConsumedReward,
} from '../../modules/providers/services/providerService'

type MerchantConsumedRewardsCardProps = {
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

export function MerchantConsumedRewardsCard({ merchantId }: MerchantConsumedRewardsCardProps) {
  const [period, setPeriod] = useState<PeriodFilter>(30)
  const [rows, setRows] = useState<ProviderConsumedReward[]>([])
  const [loading, setLoading] = useState(true)

  const periodDays = period === 'all' ? null : period

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        if (!merchantId) {
          setRows([])
          return
        }

        const data = await getProviderConsumedRewards(merchantId, {
          periodDays,
          limit: 20,
        })
        setRows(data)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [merchantId, periodDays])

  const handleExportCsv = () => {
    const suffix = period === 'all' ? 'all-time' : `${period}d`
    const filename = `merchant-rewards-consumed-${suffix}.csv`

    const csvRows = rows.map((row) => [
      row.used_at,
      row.client_nom,
      row.client_email,
      `${row.reward_emoji} ${row.reward_nom}`,
      row.points_deducted,
    ])

    downloadCsv(
      filename,
      ['used_at', 'client_nom', 'client_email', 'reward', 'points_deducted'],
      csvRows,
    )
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded-[16px] border border-gray-200 bg-white" />
  }

  return (
    <section className="rounded-[16px] border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-dark">Récompenses consommées</h2>
          <p className="mt-1 text-sm text-gray-600">Traçabilité des récompenses utilisées en caisse</p>
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
            disabled={rows.length === 0}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Aucune récompense consommée sur la période sélectionnée.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <article
              key={row.reward_id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-dark">
                  {row.reward_emoji} {row.reward_nom}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {row.client_nom}
                  {row.client_email ? ` · ${row.client_email}` : ''}
                </p>
              </div>
              <p className="text-xs font-semibold text-rose-600">-{row.points_deducted} pts</p>
              <p className="text-xs text-gray-500">
                {new Date(row.used_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                {' '}
                {new Date(row.used_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
