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
      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
        <h3 className="mb-2 text-lg font-bold text-slate-900">👥 Parrainez vos amis</h3>
        <p className="text-sm text-slate-600">
          Partagez votre code de parrainage et gagnez 200 XP + des points bonus pour chaque ami qui s'inscrit!
        </p>
      </div>

      {!referralStats ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Génération...' : '🎉 Générer Mon Code'}
        </button>
      ) : (
        <div className="space-y-4">
          {/* Code display */}
          <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
            <p className="mb-2 text-sm font-semibold text-slate-700">Votre code de parrainage</p>
            <div className="flex items-center justify-between rounded border border-indigo-200 bg-indigo-50 p-3">
              <code className="text-xl font-bold text-purple-600">
                {referralStats.code}
              </code>
              <button
                onClick={handleCopy}
                className="rounded bg-indigo-600 px-3 py-1 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                {copied ? '✅' : '📋'}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
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
              className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 font-semibold text-white hover:bg-indigo-500"
            >
              📤 Partager
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 py-2 font-semibold text-slate-700 hover:bg-slate-200"
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
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {error.message}
        </div>
      )}
    </div>
  )
}

