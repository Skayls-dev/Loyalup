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
  champion: '#0078D4',
  loyal: '#0078D4',
  at_risk: '#106EBE',
  new: '#2B88D8',
  lost: '#71AFE5',
}

const kpiAccentByLabel: Record<string, string> = {
  Providers: '#0078D4',
  Clients: '#2B88D8',
  Transactions: '#106EBE',
  'DAU/MAU': '#005A9E',
  'Active networks': '#0078D4',
  'Network revenue': '#2B88D8',
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
    <section className="space-y-6 text-[#323130]">
      <h1 className="text-2xl font-semibold text-[#323130]">Super Admin Dashboard</h1>

      <nav className="flex flex-wrap gap-1 rounded-md border border-[#edebe9] bg-white p-1 shadow-sm">
        {adminMenu.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams)
              next.set('tab', item.key)
              setSearchParams(next, { replace: true })
            }}
            className={`rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0078D4]/40 ${
              activeAdminTab === item.key
                ? 'bg-[#0078D4] font-semibold text-white'
                : 'text-[#323130] hover:bg-[#f3f2f1]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div key={activeAdminTab} className="fade-switch">
        {showOverview ? (
          <>
          {loading ? <div className="h-24 animate-pulse rounded-md border border-[#edebe9] bg-white" /> : null}

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
            <StatCard label="Providers via discovery" value={String(networkKpis.providersViaDiscovery)} accentColor="#0078D4" />
            <StatCard label="Clients via enrollment" value={String(networkKpis.clientsViaEnrollment)} accentColor="#2B88D8" />
            <StatCard label="Cross-network transfer volume" value={`${networkKpis.transferVolume.toLocaleString()} pts`} accentColor="#106EBE" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-md border border-[#edebe9] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-[17px] font-semibold text-[#323130]">Segments distribution</h3>
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
                        background: '#ffffff',
                        border: '1px solid #edebe9',
                        borderRadius: 6,
                        color: '#323130',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 space-y-1">
                {segmentDistribution.map((segment) => (
                  <div key={segment.segment_type} className="flex items-center justify-between text-sm text-[#323130]">
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

            <div className="rounded-md border border-[#edebe9] bg-white p-5 shadow-sm">
              <h3 className="mb-3 text-[17px] font-semibold text-[#323130]">Transactions timeline</h3>
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
                      tick={{ fill: '#605E5C', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #edebe9',
                        borderRadius: 6,
                        color: '#323130',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0078D4"
                      strokeWidth={2}
                      fill="url(#txGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#edebe9] bg-white p-5 text-sm text-[#323130] shadow-sm">
            <h3 className="mb-2 text-[17px] font-semibold text-[#323130]">Data asset</h3>
            <p>Analytics consent: {dataAssetValue?.analytics ?? 0}</p>
            <p>Marketing consent: {dataAssetValue?.marketing ?? 0}</p>
            <p>Third-party consent: {dataAssetValue?.third_party ?? 0}</p>
            <p>Data points: {dataAssetValue?.dataPointsCollected ?? 0}</p>
            <p>Estimated value: {(dataAssetValue?.estimatedValue ?? 0).toFixed(2)} €</p>
          </div>

          <div className="rounded-md border border-[#edebe9] bg-white p-5 text-sm text-[#323130] shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[17px] font-semibold text-[#323130]">Jobs Monitor</h3>
              <button
                type="button"
                onClick={() => {
                  runJobsNow().catch(() => undefined)
                }}
                disabled={runningJobs}
                className="h-9 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-70"
              >
                {runningJobs ? 'Running...' : 'Run jobs now'}
              </button>
            </div>

            {lastRunSummary ? <p className="mb-2 text-xs text-[#0078D4]">{lastRunSummary}</p> : null}
            {runJobsError ? <p className="mb-2 text-xs text-[#a4262c]">{runJobsError}</p> : null}

            {jobsLog.length === 0 ? (
              <p className="text-[#323130]">Aucun run de job pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {jobsLog.slice(0, 12).map((job) => (
                  <div key={job.id} className="rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2">
                    <div>
                      <p className="font-medium text-[#323130]">{job.job_name}</p>
                      <p className="text-xs text-[#605E5C]">{new Date(job.created_at).toLocaleString('fr-FR')}</p>
                    </div>

                    <div className="text-right text-xs">
                      <p className={job.status === 'success' ? 'text-[#0078D4]' : 'text-[#a4262c]'}>{job.status}</p>
                      <p className="text-[#605E5C]">{job.records_processed ?? 0} records · {job.duration_ms ?? 0} ms</p>
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
      className="rounded-md border border-[#edebe9] bg-white p-5 shadow-sm"
      style={{ borderTop: `3px solid ${accentColor}` }}
    >
      <p className="text-sm font-medium text-[#605E5C]">{label}</p>
      <p className="mt-1 text-[28px] font-bold text-[#323130]">{value}</p>
    </div>
  )
}
