import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useInstitutionDashboard } from '../hooks/useInstitutionDashboard'
import { InstitutionKpiCard } from './InstitutionKpiCard'
import type { Period } from '../types/institutionTypes'

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: '90d', label: '90 jours' },
  { value: '365d', label: '1 an' },
]

export function InstitutionDashboard() {
  const { overview, growthTimeline, merchantLeaderboard, geographicBreakdown, loading, period, setPeriod } =
    useInstitutionDashboard()

  if (loading && !overview) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">Impossible de charger le dashboard</p>
          <p className="mt-1 text-sm text-slate-600">Veuillez réessayer plus tard</p>
        </div>
      </div>
    )
  }

  const { network, period_stats, growth } = overview
  const networkName = network.name?.fr ?? network.name?.en ?? network.slug

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header with network info */}
        <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">{networkName}</h1>
                  <p className="text-sm text-slate-500">Vue institutionnelle</p>
                </div>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex flex-wrap gap-2">
              {PERIODS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    period === value
                      ? 'border border-slate-300 bg-slate-100 text-slate-900 shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <InstitutionKpiCard
            label="Nouveaux membres"
            value={period_stats.new_clients.toLocaleString()}
            delta={growth.clients_pct}
            deltaLabel="vs période précédente"
          />
          <InstitutionKpiCard
            label="Commerçants actifs"
            value={period_stats.active_merchants.toLocaleString()}
            delta={growth.merchants_pct}
            deltaLabel="vs période précédente"
          />
          <InstitutionKpiCard
            label="Points distribués"
            value={period_stats.total_bonus_distributed.toLocaleString()}
            deltaLabel="sur la période"
          />
          <InstitutionKpiCard
            label="Transactions"
            value={period_stats.transaction_count.toLocaleString()}
            deltaLabel="sur la période"
          />
        </div>

        {/* Growth Timeline Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Croissance des adhésions</h2>
          {growthTimeline.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthTimeline}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 12 }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      color: '#1e293b',
                    }}
                    labelStyle={{ color: '#1e293b' }}
                    formatter={(value, name) => {
                      if (name === 'cumulative') {
                        return [`${Number(value).toLocaleString()}`, 'Cumulatif']
                      }
                      return [`${Number(value).toLocaleString()}`, 'Nouveaux']
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#0284c7"
                    strokeWidth={2}
                    dot={false}
                    name="Cumulative"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center text-slate-500">
              Aucune donnée disponible
            </div>
          )}
        </div>

        {/* Merchant Leaderboard */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Top 10 commerçants</h2>
          {merchantLeaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Commerçant</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Localisation</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Clients uniques</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Points distribués</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {merchantLeaderboard.slice(0, 10).map((merchant, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900">{merchant.nom_commerce}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {merchant.city && merchant.country
                          ? `${merchant.city}, ${merchant.country}`
                          : merchant.country ?? 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900 font-medium">
                        {merchant.unique_clients.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {merchant.total_bonus_points.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {merchant.transaction_count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-slate-500">
              Aucun commerçant disponible
            </div>
          )}
        </div>

        {/* Geographic Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Répartition géographique</h2>
          {geographicBreakdown.length > 0 ? (
            <div className="space-y-4">
              {geographicBreakdown.map((entry, idx) => (
                <div key={idx} className="space-y-1 border-b border-slate-100 pb-4 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {entry.city && entry.country
                        ? `${entry.city}, ${entry.country}`
                        : entry.country}
                    </h3>
                    <span className="text-sm text-slate-600">
                      {entry.merchant_count} {entry.merchant_count === 1 ? 'commerçant' : 'commerçants'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{
                          width: `${(entry.client_count / (Math.max(...geographicBreakdown.map((e) => e.client_count)) || 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium text-slate-700 whitespace-nowrap">
                      {entry.client_count.toLocaleString()} clients
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-slate-500">
              Aucune donnée géographique disponible
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
