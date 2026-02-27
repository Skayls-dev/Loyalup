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
    return <div className="text-center py-8">Chargement de vos données...</div>
  }

  if (!levelData) {
    return <div className="text-center py-8 text-red-600">Erreur lors du chargement</div>
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
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <LevelBadge
                level={levelData.current_level}
                emoji={levelData.level_emoji}
                color={levelData.level_color}
                size="md"
              />
              <div>
                <h3 className="font-bold text-gray-800">
                  {levelData.level_name[language] ?? levelData.level_name['fr']}
                </h3>
                <p className="text-sm text-gray-600">
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
          <h4 className="font-bold text-gray-800 mb-3">🎯 Défis en cours</h4>
          <ChallengeList language={language} maxVisible={2} />
        </div>

        {/* Quick action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveTab('badges')}
            className="py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all text-center"
          >
            🏅 Badges
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className="py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all text-center"
          >
            🏆 Classement
          </button>
          <button
            onClick={() => setActiveTab('referral')}
            className="py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all text-center"
          >
            👥 Parrainage
          </button>
          <button
            onClick={() => setActiveTab('marketplace')}
            className="py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-center"
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
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border-2 border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Votre Progression</h2>
          <LevelBadge
            level={levelData.current_level}
            emoji={levelData.level_emoji}
            color={levelData.level_color}
            size="lg"
          />
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2">
          {levelData.level_name[language] ?? levelData.level_name['fr']}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          {levelData.xp_total.toLocaleString()} XP
        </p>

        <XPProgressBar
          current={levelData.xp_total}
          target={levelData.xp_to_next_level + levelData.xp_total}
          percent={levelData.progress_pct}
        />

        {/* Perks */}
        {levelData.perks && levelData.perks.length > 0 && (
          <div className="mt-4 pt-4 border-t border-purple-300">
            <p className="text-sm font-semibold text-gray-700 mb-2">✨ Avantages du niveau</p>
            <ul className="text-xs space-y-1 text-gray-700">
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
      <div className="flex gap-2 overflow-x-auto pb-2 bg-white p-2 rounded-lg border border-gray-200">
        {(Object.keys(tabLabels) as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full whitespace-nowrap font-semibold transition-all flex-shrink-0 ${
              activeTab === tab
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {renderTabContent()}
      </div>
    </div>
  )
}

