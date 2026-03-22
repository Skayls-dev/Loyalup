import { useEffect, useState } from 'react'
import { Users, TrendingUp, Gift, Star, Award, Zap, AlertCircle } from 'lucide-react'
import { PageHeader, SectionCard } from '../../shared/components/client-ui'
import { getReferrerAnalytics } from '../../modules/gamification/services/gamificationService'
import type { ReferrerAnalytics } from '../../modules/gamification/services/gamificationService'

const TIER_COLORS = {
  1: { bg: 'bg-slate-50', border: 'border-slate-300', text: 'text-slate-700', badge: 'bg-slate-100' },
  2: { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', badge: 'bg-blue-100' },
  3: { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-700', badge: 'bg-purple-100' },
  4: { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100' },
  5: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-100' },
}

const TIER_ICONS = {
  1: <Award className="w-8 h-8" />,
  2: <TrendingUp className="w-8 h-8" />,
  3: <Zap className="w-8 h-8" />,
  4: <Star className="w-8 h-8" />,
  5: <Gift className="w-8 h-8" />,
}

export function ReferrerAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<ReferrerAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getReferrerAnalytics()
      setAnalytics(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur en chargeant les données'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4">
        <PageHeader title="Tableau de bord Parrain" subtitle="Analysez votre réseau de filleuls" />
        <div className="mt-8 flex justify-center">
          <div className="animate-spin">
            <div className="h-8 w-8 border-4 border-slate-200 border-t-blue-500 rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !analytics) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4">
        <PageHeader title="Tableau de bord Parrain" subtitle="Analysez votre réseau de filleuls" />
        <SectionCard className="mt-8 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Erreur</h3>
              <p className="text-red-700 text-sm mt-1">{error || 'Impossible de charger les données'}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    )
  }

  const { tier, referral_stats, recent_referrals } = analytics
  const tierColor = TIER_COLORS[tier.current_tier as keyof typeof TIER_COLORS] || TIER_COLORS[1]
  const tierIcon = TIER_ICONS[tier.current_tier as keyof typeof TIER_ICONS] || TIER_ICONS[1]

  // Calculate tier progress percentage
  const tierProgressPct =
    tier.referrals_to_next === 0
      ? tier.current_tier === 5
        ? 100
        : 0
      : Math.min(100, Math.max(0, Math.round(((tier.activated_count - (tier.activated_count - tier.referrals_to_next)) / tier.referrals_to_next) * 100)))

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <PageHeader title="Tableau de bord Parrain" subtitle="Analysez votre réseau de filleuls" />

      {/* Current Tier Card */}
      <SectionCard className={`mt-8 border-2 ${tierColor.border}`}>
        <div className={`${tierColor.bg} rounded-lg p-6`}>
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`${tierColor.text} p-3 rounded-lg bg-white`}>{tierIcon}</div>
              <div>
                <h2 className={`text-2xl font-bold ${tierColor.text}`}>{tier.tier_name}</h2>
                <p className="text-sm text-gray-600 mt-1">{tier.tier_description}</p>
              </div>
            </div>
            <div className={`${tierColor.badge} px-3 py-1 rounded-full text-sm font-semibold ${tierColor.text}`}>
              Tier {tier.current_tier}/5
            </div>
          </div>

          {/* Progress Bar */}
          {tier.next_tier && tier.referrals_to_next > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progression vers {tier.next_tier}</span>
                <span className="text-sm font-semibold text-gray-700">
                  {tier.activated_count} / {tier.activated_count + tier.referrals_to_next}
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${tierColor.bg}`}
                  style={{ width: `${tierProgressPct}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {tier.referrals_to_next} {tier.referrals_to_next === 1 ? 'filleul' : 'filleuls'} de plus pour accéder au tier suivant
              </p>
            </div>
          )}

          {/* Perks */}
          {tier.perks.length > 0 && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="col-span-full text-sm font-semibold text-gray-700 mb-2">Avantages débloqués :</div>
              {tier.perks.map((perk, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className={`w-2 h-2 rounded-full ${tierColor.text}`} />
                  {perk}
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <SectionCard className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-4">
            <div className="text-sm font-medium text-blue-600 mb-1">Codes générés</div>
            <div className="text-3xl font-bold text-blue-900">{referral_stats.total_generated}</div>
            <p className="text-xs text-blue-700 mt-2">Liens de parrainage créés</p>
          </div>
        </SectionCard>

        <SectionCard className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="p-4">
            <div className="text-sm font-medium text-purple-600 mb-1">Activés</div>
            <div className="text-3xl font-bold text-purple-900">{referral_stats.activated}</div>
            <p className="text-xs text-purple-700 mt-2">Utilisateurs inscrits</p>
          </div>
        </SectionCard>

        <SectionCard className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="p-4">
            <div className="text-sm font-medium text-emerald-600 mb-1">Récompensés</div>
            <div className="text-3xl font-bold text-emerald-900">{referral_stats.rewarded}</div>
            <p className="text-xs text-emerald-700 mt-2">Premiers achats validés</p>
          </div>
        </SectionCard>

        <SectionCard className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="p-4">
            <div className="text-sm font-medium text-amber-600 mb-1">Points gagnés</div>
            <div className="text-3xl font-bold text-amber-900">{referral_stats.points_earned}</div>
            <p className="text-xs text-amber-700 mt-2">Récompenses obtenues</p>
          </div>
        </SectionCard>
      </div>

      {/* Recent Referrals */}
      {recent_referrals.length > 0 && (
        <SectionCard className="mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Filleuls récents
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Code</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Statut</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Activé le</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Récompensé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recent_referrals.map((ref, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-mono text-xs text-blue-600 font-semibold">{ref.code}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                          ref.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : ref.status === 'activated'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {ref.status === 'pending' ? 'En attente' : ref.status === 'activated' ? 'Activé' : 'Récompensé'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {ref.activated_at ? new Date(ref.activated_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-6 py-4">
                      {ref.rewarded ? <span className="text-emerald-600 font-semibold">✓ Oui</span> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Empty State */}
      {recent_referrals.length === 0 && (
        <SectionCard className="mt-6 text-center py-12">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Aucun filleul encore</p>
          <p className="text-sm text-gray-500 mt-1">Partagez votre code pour commencer à construire votre réseau</p>
        </SectionCard>
      )}
    </div>
  )
}
