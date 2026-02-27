import { useState, useEffect } from 'react'
import { useAuthStore } from '../../../auth/store/authStore'
import {
  getProviderCoalitions,
  generateProviderReferralLink,
  activateProviderReferralCode,
  getProviderReferralStats,
} from '../../services/networkService'
import { CoalitionCard } from './CoalitionCard'
import { CoalitionManagement } from './CoalitionManagement'

interface Coalition {
  id: string
  name: string
  description?: string
  logo_url?: string
  conversion_rate: number
  platform_fee_pct: number
  is_active: boolean
}

export function ProviderNetworkPage() {
  const providerId = useAuthStore((state) => state.user?.id)
  const [coalitions, setCoalitions] = useState<Coalition[]>([])
  const [selectedCoalition, setSelectedCoalition] = useState<Coalition | null>(null)
  const [providerReferralCode, setProviderReferralCode] = useState('')
  const [providerReferralLink, setProviderReferralLink] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [referralStats, setReferralStats] = useState({ generated: 0, activated: 0, rewarded: 0 })
  const [busyReferral, setBusyReferral] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!providerId) return

    const loadCoalitions = async () => {
      try {
        setLoading(true)
        const data = await getProviderCoalitions(providerId)
        setCoalitions(data)
        if (data.length > 0) {
          setSelectedCoalition(data[0])
        }
        const stats = await getProviderReferralStats(providerId)
        setReferralStats(stats)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load coalitions'))
      } finally {
        setLoading(false)
      }
    }

    loadCoalitions()
  }, [providerId])

  if (loading) {
    return <div className="text-center py-8">Chargement de vos coalitions...</div>
  }

  const handleGenerateProviderReferral = async () => {
    try {
      setBusyReferral(true)
      const data = await generateProviderReferralLink()
      setProviderReferralCode(data.referral_code)
      setProviderReferralLink(data.share_url)
      const stats = await getProviderReferralStats(providerId ?? '')
      setReferralStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate provider referral'))
    } finally {
      setBusyReferral(false)
    }
  }

  const handleActivateProviderReferral = async () => {
    if (!activationCode.trim()) return
    try {
      setBusyReferral(true)
      await activateProviderReferralCode(activationCode.trim())
      setActivationCode('')
      const stats = await getProviderReferralStats(providerId ?? '')
      setReferralStats(stats)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to activate provider referral'))
    } finally {
      setBusyReferral(false)
    }
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">Erreur: {error.message}</div>
  }

  if (coalitions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-2">🤝 Réseau de partenaires</h2>
          <p className="text-gray-700">
            Vous n'êtes pas encore membre d'une coalition. Contactez un administrateur pour rejoindre un réseau!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">🤝 Réseau de partenaires</h1>
        <p className="text-gray-600">Gérez vos coalitions et vos partenaires</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-800">🚀 Parrainage provider</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
            <div className="text-xl font-bold text-blue-700">{referralStats.generated}</div>
            <div className="text-xs font-semibold text-blue-800">Codes générés</div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
            <div className="text-xl font-bold text-purple-700">{referralStats.activated}</div>
            <div className="text-xs font-semibold text-purple-800">Codes activés</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-xl font-bold text-emerald-700">{referralStats.rewarded}</div>
            <div className="text-xs font-semibold text-emerald-800">Récompensés</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleGenerateProviderReferral}
            disabled={busyReferral}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
          >
            {busyReferral ? 'Génération...' : 'Générer un code provider'}
          </button>
          {providerReferralCode ? (
            <div className="text-sm text-gray-700">
              Code: <span className="font-bold text-indigo-700">{providerReferralCode}</span>
            </div>
          ) : null}
        </div>

        {providerReferralLink ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 break-all">
            {providerReferralLink}
          </div>
        ) : null}

        <div className="flex gap-2">
          <input
            value={activationCode}
            onChange={(event) => setActivationCode(event.target.value)}
            placeholder="Code referral provider à activer"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
          <button
            onClick={handleActivateProviderReferral}
            disabled={busyReferral || !activationCode.trim()}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            Activer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coalition list */}
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-gray-800">Mes coalitions</h2>
          <div className="space-y-3">
            {coalitions.map((coalition) => (
              <CoalitionCard
                key={coalition.id}
                coalition={coalition}
                isSelected={selectedCoalition?.id === coalition.id}
                onSelect={setSelectedCoalition}
              />
            ))}
          </div>
        </div>

        {/* Coalition details */}
        <div className="lg:col-span-2">
          {selectedCoalition ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {selectedCoalition.name}
                </h2>
                {selectedCoalition.description && (
                  <p className="text-gray-700">{selectedCoalition.description}</p>
                )}
              </div>

              <CoalitionManagement coalitionId={selectedCoalition.id} />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-gray-600">Sélectionnez une coalition pour voir les détails</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



