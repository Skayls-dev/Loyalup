import { useState } from 'react'
import { LoyaltyCardList } from '../../modules/loyalty/components/LoyaltyCardList'
import { RewardList } from '../../modules/loyalty/components/RewardList'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'
import { PromoList } from '../../modules/promotions/components/PromoList'
import { usePromotions } from '../../modules/promotions/hooks/usePromotions'
import { NetworkDiscovery } from '../../modules/networks/components/client'
import { useNetworks } from '../../modules/networks/hooks/useNetworks'
import { useNetworkAnnouncements } from '../../modules/networks/hooks/useNetworkAnnouncements'

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
      <div className="grid grid-cols-5 gap-1 rounded-2xl border border-zinc-700 bg-zinc-900/80 p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => handleTabChange('cards')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] ${
            activeTab === 'cards'
              ? 'tab-pop tab-glow bg-indigo-100 text-indigo-700 shadow-sm motion-safe:hover:shadow-lg'
              : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          Mes cartes
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('promotions')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] ${
            activeTab === 'promotions'
              ? 'tab-pop tab-glow bg-indigo-100 text-indigo-700 shadow-sm motion-safe:hover:shadow-lg'
              : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
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
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] ${
            activeTab === 'history'
              ? 'tab-pop tab-glow bg-indigo-100 text-indigo-700 shadow-sm motion-safe:hover:shadow-lg'
              : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          Historique
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('rewards')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] ${
            activeTab === 'rewards'
              ? 'tab-pop tab-glow bg-indigo-100 text-indigo-700 shadow-sm motion-safe:hover:shadow-lg'
              : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
          }`}
        >
          Récompenses
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('networks')}
          className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.02] ${
            activeTab === 'networks'
              ? 'tab-pop tab-glow bg-indigo-100 text-indigo-700 shadow-sm motion-safe:hover:shadow-lg'
              : 'text-zinc-500 hover:bg-indigo-50 hover:text-indigo-700'
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
            <div className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-3 text-sm text-zinc-300">
              Rejoignez votre premier réseau pour débloquer les bonus multi-commerces et les annonces thématiques.
            </div>
          ) : null}
          <NetworkDiscovery />
        </div>
      ) : null}
    </section>
  )
}
