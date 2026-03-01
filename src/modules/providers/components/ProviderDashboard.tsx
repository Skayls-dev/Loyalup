import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QRDisplay } from '../../qr/components/QRDisplay'
import { PromoManager } from '../../promotions/components/PromoManager'
import { ProviderAnalytics } from '../../analytics/components/ProviderAnalytics'
import { ConsentSettings } from '../../../shared/components/ConsentSettings'
import { DataExportButton } from '../../../shared/components/DataExportButton'
import { useProviderStats } from '../hooks/useProviderStats'
import { ClientList } from './ClientList'
import { RecentTransactions } from './RecentTransactions'
import { RewardRuleManager } from './RewardRuleManager'
import { ServiceManager } from './ServiceManager'
import { StatsGrid } from './StatsGrid'
import { WhiteLabelConfig } from './WhiteLabelConfig'
import { DeveloperPortal } from './DeveloperPortal'
import { ProviderNetworkHub } from '../../networks/components/provider'

type DashboardTab =
  | 'qr'
  | 'dashboard'
  | 'clients'
  | 'promotions'
  | 'networks'
  | 'settings'
  | 'white-label'
  | 'developers'

const tabs: Array<{ key: DashboardTab; label: string }> = [
  { key: 'qr', label: 'QR Code' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'clients', label: 'Clients' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'networks', label: 'Réseaux' },
  { key: 'settings', label: 'Paramètres' },
  { key: 'white-label', label: 'White Label' },
  { key: 'developers', label: 'Developer Portal' },
]

export function ProviderDashboard() {
  const [searchParams] = useSearchParams()
  const tabFromQuery = searchParams.get('tab') as DashboardTab | null
  const activeTab: DashboardTab = tabFromQuery && tabs.some((item) => item.key === tabFromQuery) ? tabFromQuery : 'qr'

  const { stats, loading, fournisseurId, lastUpdated } = useProviderStats()

  const dashboardContent = useMemo(() => {
    if (activeTab === 'qr') {
      return <QRDisplay />
    }

    if (activeTab === 'dashboard') {
      return (
        <div className="space-y-4">
          <StatsGrid stats={stats} loading={loading} />
          <ProviderAnalytics />
          <RecentTransactions fournisseur_id={fournisseurId} />
          <p className="text-right text-xs text-zinc-500">
            Dernière mise à jour: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '-'}
          </p>
        </div>
      )
    }

    if (activeTab === 'clients') {
      return <ClientList />
    }

    if (activeTab === 'promotions') {
      return <PromoManager />
    }

    if (activeTab === 'networks') {
      return <ProviderNetworkHub />
    }

    if (activeTab === 'white-label') {
      return <WhiteLabelConfig />
    }

    if (activeTab === 'developers') {
      return <DeveloperPortal />
    }

    return (
      <div className="space-y-4">
        <ServiceManager />
        <RewardRuleManager />
        <ConsentSettings locale="fr" />
        <DataExportButton />
      </div>
    )
  }, [activeTab, fournisseurId, lastUpdated, loading, stats])

  return (
    <section className="w-full space-y-4">
      {dashboardContent}
    </section>
  )
}
