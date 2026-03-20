import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminAnalytics } from '../../modules/analytics/hooks/useAdminAnalytics'
import { AdminControlCenter, type AdminTab } from '../../modules/admin/components/AdminControlCenter'
import { getPlatformNetworkOverview } from '../../modules/networks/services/networkService'
import { supabase } from '../../shared/lib/supabaseClient'
import {
  Activity,
  BarChart2,
  CheckCircle2,
  Clock,
  Database,
  Play,
  Store,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'

const adminMenu: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'api', label: 'API Ops' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit', label: 'Audit' },
  { key: 'ads', label: 'Ads' },
]

const segmentColors: Record<string, string> = {
  champion: '#7c3aed',
  loyal: '#6366f1',
  at_risk: '#f59e0b',
  new: '#10b981',
  lost: '#ef4444',
}

function isAdminTab(value: string | null): value is AdminTab {
  return value === 'overview' || value === 'users' || value === 'api' || value === 'webhooks' || value === 'audit' || value === 'ads'
}

export function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeAdminTab: AdminTab = isAdminTab(tabParam) ? tabParam : 'overview'

  const {
    platformStats,
    segmentDistribution,
    dataAssetValue,
    jobsLog,
    runningJobs,
    runJobsError,
    lastRunSummary,
    runJobsNow,
    loading,
  } = useAdminAnalytics()
  const [networkKpis, setNetworkKpis] = useState({
    activeNetworks: 0,
    totalEnrollments: 0,
    avgNetworksPerClient: 0,
    totalBonusDistributed: 0,
    networkRevenue: 0,
    providersViaDiscovery: 0,
    clientsViaEnrollment: 0,
    transferVolume: 0,
  })

  useEffect(() => {
    const loadNetworkKpis = async () => {
      const networks = await getPlatformNetworkOverview().catch(() => [])
      const totalEnrollments = networks.reduce((sum, row) => sum + row.client_count, 0)
      const activeNetworks = networks.filter((row) => row.is_active && !row.is_draft).length

      const [clientsCountQuery, bonusQuery, sponsorshipQuery, transferQuery] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('network_point_events').select('bonus_points'),
        supabase.from('network_sponsorships').select('amount').eq('payment_status', 'active'),
        supabase.from('point_transfers').select('points_credited'),
      ])

      const clientsCount = Number(clientsCountQuery.count ?? 0)
      const totalBonusDistributed = ((bonusQuery.data ?? []) as Array<{ bonus_points: number }>).reduce(
        (sum, row) => sum + Number(row.bonus_points ?? 0),
        0,
      )
      const networkRevenue = ((sponsorshipQuery.data ?? []) as Array<{ amount: number }>).reduce(
        (sum, row) => sum + Number(row.amount ?? 0),
        0,
      )
      const transferVolume = ((transferQuery.data ?? []) as Array<{ points_credited: number }>).reduce(
        (sum, row) => sum + Number(row.points_credited ?? 0),
        0,
      )

      setNetworkKpis({
        activeNetworks,
        totalEnrollments,
        avgNetworksPerClient: clientsCount > 0 ? totalEnrollments / clientsCount : 0,
        totalBonusDistributed,
        networkRevenue,
        providersViaDiscovery: networks.reduce((sum, row) => sum + row.member_count, 0),
        clientsViaEnrollment: totalEnrollments,
        transferVolume,
      })
    }

    void loadNetworkKpis()
  }, [])

  const networkKpiCards = useMemo(
    () => [
      { label: 'Active networks', value: String(networkKpis.activeNetworks) },
      { label: 'Network enrollments', value: String(networkKpis.totalEnrollments) },
      { label: 'Avg networks/client', value: networkKpis.avgNetworksPerClient.toFixed(2) },
      { label: 'Bonus distributed', value: `${networkKpis.totalBonusDistributed.toLocaleString()} pts` },
      { label: 'Network revenue', value: `${networkKpis.networkRevenue.toLocaleString()} €` },
    ],
    [networkKpis],
  )

  const timelineData = useMemo(() => {
    const buckets = new Map<string, number>()

    for (const row of jobsLog) {
      const date = new Date(row.created_at)
      if (Number.isNaN(date.getTime())) {
        continue
      }

      const key = date.toISOString().slice(5, 10)
      buckets.set(key, (buckets.get(key) ?? 0) + Number(row.records_processed ?? 0))
    }

    const built = Array.from(buckets.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date))

    if (built.length > 0) {
      return built.slice(-10)
    }

    return [{ date: '—', value: 0 }]
  }, [jobsLog])

  const showOverview = activeAdminTab === 'overview'

  return (
    <section className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
          Console opérationnelle
        </span>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {adminMenu.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.set('tab', item.key)
              setSearchParams(next, { replace: true })
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
              activeAdminTab === item.key
                ? 'bg-violet-600 font-semibold text-white shadow'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div key={activeAdminTab}>
        {showOverview ? (
          <div className="space-y-6">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
                ))}
              </div>
            ) : null}

            {/* Platform KPIs */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Plateforme</p>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  label="Marchands"
                  value={String(platformStats?.totalProviders ?? 0)}
                  icon={<Store className="h-4 w-4" />}
                  color="violet"
                />
                <StatCard
                  label="Clients"
                  value={String(platformStats?.totalClients ?? 0)}
                  icon={<Users className="h-4 w-4" />}
                  color="indigo"
                />
                <StatCard
                  label="Transactions"
                  value={String(platformStats?.totalTransactions ?? 0)}
                  icon={<Activity className="h-4 w-4" />}
                  color="blue"
                />
                <StatCard
                  label="DAU/MAU"
                  value={`${((platformStats?.dauMauRatio ?? 0) * 100).toFixed(1)}%`}
                  icon={<Zap className="h-4 w-4" />}
                  color="emerald"
                />
              </div>
            </div>

            {/* Network KPIs */}
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Réseaux</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {networkKpiCards.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                  >
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Marchands via discovery</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{networkKpis.providersViaDiscovery}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Clients via enrollment</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{networkKpis.clientsViaEnrollment}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium text-slate-500">Transferts cross-réseau</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{networkKpis.transferVolume.toLocaleString()} pts</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                    <Users className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Distribution segments</h3>
                    <p className="text-xs text-slate-500">Répartition clients par segment</p>
                  </div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={segmentDistribution} dataKey="total" nameKey="segment_type" outerRadius={90} innerRadius={40}>
                        {segmentDistribution.map((entry, index) => (
                          <Cell
                            key={`${entry.segment_type}-${index}`}
                            fill={segmentColors[entry.segment_type] ?? '#94a3b8'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  {segmentDistribution.map((seg) => (
                    <div key={seg.segment_type} className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segmentColors[seg.segment_type] ?? '#94a3b8' }} />
                        <span className="capitalize text-slate-700">{seg.segment_type}</span>
                      </div>
                      <span className="font-semibold text-slate-900">{seg.total}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <BarChart2 className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Timeline transactions</h3>
                    <p className="text-xs text-slate-500">Activité de traitement sur 10 périodes</p>
                  </div>
                </div>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData}>
                      <defs>
                        <linearGradient id="txGradientNew" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, color: '#0f172a', fontSize: 12 }} />
                      <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} fill="url(#txGradientNew)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Bottom row: Data asset + Jobs Monitor */}
            <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
              {/* Data asset */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Database className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Data asset</h3>
                    <p className="text-xs text-slate-500">Valeur estimée du patrimoine données</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Analytics consent', value: dataAssetValue?.analytics ?? 0 },
                    { label: 'Marketing consent', value: dataAssetValue?.marketing ?? 0 },
                    { label: 'Third-party consent', value: dataAssetValue?.third_party ?? 0 },
                    { label: 'Data points', value: dataAssetValue?.dataPointsCollected ?? 0 },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-600">{row.label}</span>
                      <span className="font-semibold text-slate-900">{row.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-800">Valeur estimée</span>
                    <span className="text-lg font-extrabold text-emerald-700">{(dataAssetValue?.estimatedValue ?? 0).toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Jobs Monitor */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Clock className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Jobs Monitor</h3>
                      <p className="text-xs text-slate-500">Derniers runs de traitement</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { runJobsNow().catch(() => undefined) }}
                    disabled={runningJobs}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                  >
                    <Play className="h-3 w-3" />
                    {runningJobs ? 'En cours...' : 'Lancer'}
                  </button>
                </div>

                {lastRunSummary ? (
                  <p className="mb-3 rounded-md bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">{lastRunSummary}</p>
                ) : null}
                {runJobsError ? (
                  <p className="mb-3 rounded-md bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">{runJobsError}</p>
                ) : null}

                <div className="max-h-[280px] space-y-2 overflow-y-auto">
                  {jobsLog.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-500">
                      Aucun run de job enregistré.
                    </p>
                  ) : (
                    jobsLog.slice(0, 12).map((job) => (
                      <div
                        key={job.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900">{job.job_name}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{new Date(job.created_at).toLocaleString('fr-FR')}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              job.status === 'success'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {job.status === 'success' ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : (
                              <XCircle className="h-2.5 w-2.5" />
                            )}
                            {job.status}
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {job.records_processed ?? 0} rec · {job.duration_ms ?? 0} ms
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <AdminControlCenter initialTab={activeAdminTab} />
        )}
      </div>
    </section>
  )
}

type StatColor = 'violet' | 'indigo' | 'blue' | 'emerald' | 'amber' | 'rose'

const colorMap: Record<StatColor, { bg: string; text: string; icon: string }> = {
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', icon: 'text-violet-600' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', icon: 'text-indigo-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   icon: 'text-blue-600'   },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-600',icon: 'text-emerald-600'},
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  icon: 'text-amber-600'  },
  rose:   { bg: 'bg-rose-50',   text: 'text-rose-600',   icon: 'text-rose-600'   },
}

function StatCard({
  label,
  value,
  icon,
  color = 'violet',
}: {
  label: string
  value: string
  icon?: React.ReactNode
  color?: StatColor
}) {
  const c = colorMap[color]
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-px hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-widest text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">{value}</p>
        </div>
        {icon ? (
          <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.icon}`}>
            {icon}
          </span>
        ) : null}
      </div>
      <span className={`absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.06] ${c.bg}`} aria-hidden="true" />
    </div>
  )
}
