import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { UpgradePrompt } from '../../../shared/components/UpgradePrompt'
import { useProviderAnalytics } from '../hooks/useProviderAnalytics'

const SEGMENT_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7']

export function ProviderAnalytics() {
  const { stats, benchmarks, segments, timeline, loading, period, setPeriod, isPremium, churnList } = useProviderAnalytics()

  return (
    <section className="relative space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900/85 p-5 text-zinc-100 shadow-sm">
      {!isPremium ? <UpgradePrompt feature="Analytics Premium" tier_required="premium" /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Analytics Premium</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d', '12m'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                period === value
                  ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="h-24 animate-pulse rounded-lg bg-zinc-800/70" /> : null}

      {stats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
          <Kpi label="Revenue" value={`${stats.revenue.toFixed(2)} €`} />
          <Kpi label="Transactions" value={String(stats.transactions)} />
          <Kpi label="Panier moyen" value={`${stats.avgBasket.toFixed(2)} €`} />
          <Kpi label="Rétention" value={`${stats.retentionRate.toFixed(1)} %`} />
          <Kpi label="Churn" value={`${stats.churnRate.toFixed(1)} %`} />
          <Kpi label="Best hour" value={`${stats.bestHour}h`} />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 rounded-2xl border border-zinc-700 bg-zinc-900/75 p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-lg">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Revenue timeline</h3>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={timeline}>
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#60a5fa" name="Revenue" />
              <Line dataKey="transactions" stroke="#f59e0b" name="Transactions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-2xl border border-zinc-700 bg-zinc-900/75 p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-lg">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">Segments clients</h3>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={segments} dataKey="total" nameKey="segment_type" outerRadius={90}>
                {segments.map((entry, index) => (
                  <Cell key={`${entry.segment_type}-${index}`} fill={SEGMENT_COLORS[index % SEGMENT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/75 p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-lg">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Benchmarks</h3>
        <div className="space-y-2 text-xs text-zinc-300">
          {benchmarks.slice(0, 5).map((item) => (
            <div key={`${item.metric_key}-${item.period}`} className="flex items-center justify-between rounded-lg border border-zinc-700 px-2.5 py-1.5">
              <span>{item.metric_key}</span>
              <span>
                {Number(item.metric_value ?? 0).toFixed(2)} vs avg {Number(item.industry_avg ?? 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-700 bg-zinc-900/75 p-4 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-lg">
        <h3 className="mb-3 text-sm font-semibold text-zinc-300">Clients à risque</h3>
        <div className="space-y-2 text-xs text-zinc-300">
          {churnList.length === 0 ? <p>Aucun client à risque</p> : churnList.map((clientId) => <p key={clientId}>{clientId}</p>)}
        </div>
      </div>
    </section>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/75 p-3.5 shadow-sm transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.01] motion-safe:hover:shadow-lg">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-none text-zinc-100">{value}</p>
    </div>
  )
}
