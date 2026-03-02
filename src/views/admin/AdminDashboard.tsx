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
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAdminAnalytics } from '../../modules/analytics/hooks/useAdminAnalytics'
import { AdminControlCenter, type AdminTab } from '../../modules/admin/components/AdminControlCenter'
import { getPlatformNetworkOverview } from '../../modules/networks/services/networkService'
import { supabase } from '../../shared/lib/supabaseClient'

const adminMenu: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'api', label: 'API Ops' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit', label: 'Audit' },
  { key: 'ads', label: 'Ads' },
]

const segmentColors: Record<string, string> = {
  champion: '#50B0FF',
  loyal: '#0078D4',
  at_risk: '#005A9E',
  new: '#2899F5',
  lost: '#6B9AC4',
}

const kpiAccentByLabel: Record<string, string> = {
  Providers: '#6366F1',
  Clients: '#06B6D4',
  Transactions: '#F59E0B',
  'DAU/MAU': '#10B981',
  'Active networks': '#8B5CF6',
  'Network revenue': '#F43F5E',
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
    <section className="space-y-8 bg-[#061224] p-6 text-[#F5FAFF]">
      <h1 className="text-xl font-semibold text-white">Super Admin Dashboard</h1>

      <nav className="flex flex-wrap gap-1 rounded-xl border border-[rgba(80,176,255,0.25)] bg-[#071B33] p-1">
        {adminMenu.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.set('tab', item.key)
              setSearchParams(next, { replace: true })
            }}
            className={`rounded-lg px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
              activeAdminTab === item.key
                ? 'bg-[#0D3A66] font-semibold text-white'
                : 'text-[#8FBCE6] hover:text-white'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div key={activeAdminTab} className="fade-switch">
        {showOverview ? (
          <>
          {loading ? <div className="h-24 animate-pulse rounded-lg bg-white/10" /> : null}

          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <StatCard label="Providers" value={String(platformStats?.totalProviders ?? 0)} accentColor={kpiAccentByLabel.Providers} />
            <StatCard label="Clients" value={String(platformStats?.totalClients ?? 0)} accentColor={kpiAccentByLabel.Clients} />
            <StatCard label="Transactions" value={String(platformStats?.totalTransactions ?? 0)} accentColor={kpiAccentByLabel.Transactions} />
            <StatCard label="DAU/MAU" value={`${((platformStats?.dauMauRatio ?? 0) * 100).toFixed(1)}%`} accentColor={kpiAccentByLabel['DAU/MAU']} />
          </div>

          <div className="grid gap-6 md:grid-cols-5">
            {networkKpiCards.map((item) => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                accentColor={kpiAccentByLabel[item.label] ?? '#27272A'}
              />
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <StatCard label="Providers via discovery" value={String(networkKpis.providersViaDiscovery)} accentColor="#8B5CF6" />
            <StatCard label="Clients via enrollment" value={String(networkKpis.clientsViaEnrollment)} accentColor="#06B6D4" />
            <StatCard label="Cross-network transfer volume" value={`${networkKpis.transferVolume.toLocaleString()} pts`} accentColor="#F59E0B" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[#A1A1AA]">Segments distribution</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segmentDistribution} dataKey="total" nameKey="segment_type" outerRadius={96}>
                      {segmentDistribution.map((entry, index) => (
                        <Cell
                          key={`${entry.segment_type}-${index}`}
                          fill={segmentColors[entry.segment_type] ?? '#71717A'}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: '#0A223D',
                        border: '1px solid rgba(80,176,255,0.3)',
                        borderRadius: 10,
                        color: '#F5FAFF',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1">
                {segmentDistribution.map((segment) => (
                  <div key={segment.segment_type} className="flex items-center justify-between text-sm text-[#D7ECFF]">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: segmentColors[segment.segment_type] ?? '#71717A' }}
                      />
                      <span>{segment.segment_type}</span>
                    </div>
                    <span>{segment.total}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] p-4">
              <h3 className="mb-3 text-sm font-semibold text-[#A1A1AA]">Transactions timeline</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <defs>
                      <linearGradient id="txGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(0,120,212,0.22)" />
                        <stop offset="100%" stopColor="rgba(0,120,212,0)" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#8FBCE6', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0A223D',
                        border: '1px solid rgba(80,176,255,0.3)',
                        borderRadius: 10,
                        color: '#F5FAFF',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2899F5"
                      strokeWidth={2}
                      fill="url(#txGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] p-4 text-sm text-[#D7ECFF]">
            <h3 className="mb-2 text-sm font-semibold text-[#A1A1AA]">Data asset</h3>
            <p>Analytics consent: {dataAssetValue?.analytics ?? 0}</p>
            <p>Marketing consent: {dataAssetValue?.marketing ?? 0}</p>
            <p>Third-party consent: {dataAssetValue?.third_party ?? 0}</p>
            <p>Data points: {dataAssetValue?.dataPointsCollected ?? 0}</p>
            <p>Estimated value: {(dataAssetValue?.estimatedValue ?? 0).toFixed(2)} €</p>
          </div>

          <div className="rounded-2xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] p-4 text-sm text-[#D7ECFF]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[#A1A1AA]">Jobs Monitor</h3>
              <button
                type="button"
                onClick={() => {
                  runJobsNow().catch(() => undefined)
                }}
                disabled={runningJobs}
                className="rounded-xl border border-[rgba(80,176,255,0.35)] bg-[#0D3A66] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#106EBE] disabled:opacity-70"
              >
                {runningJobs ? 'Running...' : 'Run jobs now'}
              </button>
            </div>

            {lastRunSummary ? <p className="mb-2 text-xs text-[#7CC6FF]">{lastRunSummary}</p> : null}
            {runJobsError ? <p className="mb-2 text-xs text-red-400">{runJobsError}</p> : null}

            {jobsLog.length === 0 ? (
              <p className="text-[#D7ECFF]">Aucun run de job pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {jobsLog.slice(0, 12).map((job) => (
                  <div key={job.id} className="rounded-xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] px-3 py-2">
                    <div>
                      <p className="font-medium text-white">{job.job_name}</p>
                      <p className="text-xs text-[#8FBCE6]">{new Date(job.created_at).toLocaleString('fr-FR')}</p>
                    </div>

                    <div className="text-right text-xs">
                      <p className={job.status === 'success' ? 'text-[#7CC6FF]' : 'text-red-400'}>{job.status}</p>
                      <p className="text-[#D7ECFF]">{job.records_processed ?? 0} records · {job.duration_ms ?? 0} ms</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        ) : (
          <AdminControlCenter initialTab={activeAdminTab} />
        )}
      </div>
    </section>
  )
}

function StatCard({ label, value, accentColor }: { label: string; value: string; accentColor: string }) {
  return (
    <div
      className="rounded-2xl border border-[rgba(80,176,255,0.25)] bg-[#0A223D] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(80,176,255,0.45)] hover:shadow-[0_12px_28px_rgba(0,120,212,0.22)]"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <p className="text-xs font-medium text-[#71717A]">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-[#FAFAFA]">{value}</p>
    </div>
  )
}
