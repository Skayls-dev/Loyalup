import { useState } from 'react'
import {
  LevelBadge,
  XPProgressBar,
  ChallengeList,
  StreakDisplay,
  BadgeGallery,
  LeaderboardView,
  ReferralView,
  MarketplaceView,
} from './components'
import { useClientLevel } from './hooks'

interface GamificationWidgetProps {
  layout?: 'compact' | 'full'
  language?: string
}

type TabType = 'overview' | 'challenges' | 'badges' | 'leaderboard' | 'referral' | 'marketplace'

const tabLabels: Record<TabType, string> = {
  overview: '🏠 Accueil',
  challenges: '🎯 Défis',
  badges: '🏅 Badges',
  leaderboard: '🏆 Rang',
  referral: '👥 Parrainage',
  marketplace: '🏪 Marché',
}

export function GamificationWidget({
  layout = 'full',
  language = 'fr',
}: GamificationWidgetProps) {
  const { levelData, loading } = useClientLevel()
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  if (loading) {
    return <div className="rounded-2xl border border-white/70 bg-white/85 py-8 text-center text-slate-600 shadow-sm shadow-slate-900/5">Chargement de vos données...</div>
  }

  if (!levelData) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 py-8 text-center text-rose-700">Erreur lors du chargement</div>
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-4">
            <ChallengeList language={language} maxVisible={3} />
            <StreakDisplay language={language} />
          </div>
        )
      case 'challenges':
        return <ChallengeList language={language} />
      case 'badges':
        return <BadgeGallery language={language} />
      case 'leaderboard':
        return <LeaderboardView type="global_xp" />
      case 'referral':
        return <ReferralView language={language} />
      case 'marketplace':
        return <MarketplaceView />
      default:
        return null
    }
  }

  if (layout === 'compact') {
    // Compact view for mobile home screen
    return (
      <div className="space-y-4">
        {/* Level header card */}
        <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5 backdrop-blur">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <LevelBadge
                level={levelData.current_level}
                emoji={levelData.level_emoji}
                color={levelData.level_color}
                size="md"
              />
              <div>
                <h3 className="font-bold text-slate-900">
                  {levelData.level_name[language] ?? levelData.level_name['fr']}
                </h3>
                <p className="text-sm text-slate-500">
                  {levelData.xp_total.toLocaleString()} XP
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3">
            <XPProgressBar
              current={levelData.xp_total}
              target={levelData.xp_to_next_level + levelData.xp_total}
              percent={levelData.progress_pct}
            />
          </div>
        </div>

        {/* Challenge preview */}
        <div>
          <h4 className="mb-3 font-bold text-slate-900">🎯 Défis en cours</h4>
          <ChallengeList language={language} maxVisible={2} />
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab('badges')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
          >
            🏅 Badges
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
          >
            🏆 Classement
          </button>
          <button
            onClick={() => setActiveTab('referral')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
          >
            👥 Parrainage
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center font-bold text-slate-700 transition hover:bg-slate-50"
          >
            🏪 Marché
          </button>
        </div>
      </div>
    )
  }

  // Full view with tabs
  return (
    <div className="space-y-4">
      {/* Level header card */}
      <div className="rounded-2xl border border-white/70 bg-white/85 p-6 shadow-sm shadow-slate-900/5 backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-slate-900">Votre Progression</h2>
          <LevelBadge
            level={levelData.current_level}
            emoji={levelData.level_emoji}
            color={levelData.level_color}
            size="lg"
          />
        </div>

        <h3 className="mb-2 text-xl font-bold text-slate-900">
          {levelData.level_name[language] ?? levelData.level_name['fr']}
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          {levelData.xp_total.toLocaleString()} XP
        </p>

        <XPProgressBar
          current={levelData.xp_total}
          target={levelData.xp_to_next_level + levelData.xp_total}
          percent={levelData.progress_pct}
        />

        {/* Perks */}
        {levelData.perks && levelData.perks.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">✨ Avantages du niveau</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {levelData.perks.map((perk, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="mr-2">→</span>
                  <span>{perk.description[language] ?? perk.description['fr']}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/70 bg-white/85 p-2 shadow-sm shadow-slate-900/5">
        {(Object.keys(tabLabels) as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all flex-shrink-0 ${
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
        {renderTabContent()}
      </div>
    </div>
  )
}

