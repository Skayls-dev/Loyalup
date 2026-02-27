import { useState } from 'react'
import { useReferral } from '../hooks'

interface ReferralViewProps {
  language?: string
}

export function ReferralView({ language = 'fr' }: ReferralViewProps) {
  const { referralStats, loading, error, generateLink } = useReferral()
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (referralStats?.url) {
      navigator.clipboard.writeText(referralStats.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = () => {
    if (referralStats?.url && navigator.share) {
      navigator.share({
        title: 'Rejoignez-moi sur LoyalUp!',
        text: 'Gagnez des points de bienvenue avec mon code parrainage',
        url: referralStats.url,
      })
    } else {
      handleCopy()
    }
  }

  const handleGenerate = async () => {
    try {
      await generateLink()
    } catch (err) {
      console.error('Failed to generate referral link:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-2">👥 Parrainez vos amis</h3>
        <p className="text-sm text-gray-700">
          Partagez votre code de parrainage et gagnez 200 XP + des points bonus pour chaque ami qui s'inscrit!
        </p>
      </div>

      {!referralStats ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50"
        >
          {loading ? 'Génération...' : '🎉 Générer Mon Code'}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Code display */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-2 border-purple-300">
            <p className="text-sm font-semibold text-gray-700 mb-2">Votre code de parrainage</p>
            <div className="bg-white p-3 rounded border-2 border-purple-300 flex items-center justify-between">
              <code className="text-xl font-bold text-purple-600">
                {referralStats.code}
              </code>
              <button
                onClick={handleCopy}
                className="px-3 py-1 bg-purple-500 text-white text-sm rounded font-semibold hover:bg-purple-600 transition-colors"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Expire le {new Date(referralStats.url).toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-800">
                {referralStats.total_generated}
              </div>
              <p className="text-xs text-gray-600 font-semibold">Générés</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {referralStats.activated}
              </div>
              <p className="text-xs text-blue-700 font-semibold">Activés</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <div className="text-2xl font-bold text-emerald-600">
                {referralStats.rewarded}
              </div>
              <p className="text-xs text-emerald-700 font-semibold">Récompensés</p>
            </div>
          </div>

          {/* Share buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              📤 Partager
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-all"
            >
              📋 Copier
            </button>
          </div>

          {/* Points earned */}
          {referralStats.points_earned > 0 && (
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-lg border border-yellow-200">
              <p className="text-sm text-gray-700">Points gagnés par parrainages</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                +{referralStats.points_earned}
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm font-semibold">
          {error.message}
        </div>
      )}
    </div>
  )
}

