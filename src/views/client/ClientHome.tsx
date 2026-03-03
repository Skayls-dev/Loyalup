import { useState } from 'react'
import { LoyaltyCardList } from '../../modules/loyalty/components/LoyaltyCardList'
import { RewardList } from '../../modules/loyalty/components/RewardList'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'
import { PromoList } from '../../modules/promotions/components/PromoList'
import { usePromotions } from '../../modules/promotions/hooks/usePromotions'
import { NetworkDiscovery } from '../../modules/networks/components/client'
import { useNetworks } from '../../modules/networks/hooks/useNetworks'
import { useNetworkAnnouncements } from '../../modules/networks/hooks/useNetworkAnnouncements'
import { EmptyState, PageHeader, SectionCard } from '../../shared/components/client-ui'

type HomeTab = 'cards' | 'promotions' | 'history' | 'rewards' | 'networks'

export function ClientHome() {
  const [activeTab, setActiveTab] = useState<HomeTab>('cards')
  const { newPromotionsCount, clearNewPromotionsCount } = usePromotions()
  const { enrolled } = useNetworks()
  const { unreadCount } = useNetworkAnnouncements()

  const handleTabChange = (tab: HomeTab) => {
    setActiveTab(tab)

    if (tab === 'promotions') {
      clearNewPromotionsCount()
    }
  }

  return (
    <section className="space-y-4">
      <PageHeader title="Mes cartes" subtitle="Suivi de vos programmes, promos et récompenses" />

      <div className="grid grid-cols-5 gap-1 rounded-2xl border border-slate-200/60 bg-white/80 p-1.5 shadow-sm shadow-slate-900/5 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => handleTabChange('cards')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'cards'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Mes cartes
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('promotions')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'promotions'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            Promotions
            {newPromotionsCount > 0 ? (
              <span className="inline-flex h-2 w-2 rounded-full bg-red-500" aria-label="Nouvelles promos" />
            ) : null}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Historique
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('rewards')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'rewards'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          Récompenses
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('networks')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
            activeTab === 'networks'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            Réseaux
            {unreadCount > 0 ? (
              <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] text-white">
                {unreadCount}
              </span>
            ) : null}
          </span>
        </button>
      </div>

      {activeTab === 'cards' ? <LoyaltyCardList /> : null}
      {activeTab === 'promotions' ? <PromoList /> : null}
      {activeTab === 'history' ? <TransactionHistory /> : null}
      {activeTab === 'rewards' ? <RewardList /> : null}
      {activeTab === 'networks' ? (
        <div className="space-y-3">
          {enrolled.length === 0 ? (
            <EmptyState
              title="Aucun réseau rejoint"
              description="Rejoignez votre premier réseau pour débloquer les bonus multi-commerces et les annonces thématiques."
            />
          ) : null}
          <SectionCard>
            <NetworkDiscovery />
          </SectionCard>
        </div>
      ) : null}
    </section>
  )
}
