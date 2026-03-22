import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../modules/auth/hooks/useAuth'
import { activateReferralByCode } from '../modules/gamification/services/gamificationService'

const PENDING_REFERRAL_STORAGE_KEY = 'loyalup_pending_referral_code'

type ActivationState = 'idle' | 'loading' | 'success' | 'error'

export default function ReferralJoinPage() {
  const { referralCode = '' } = useParams<{ referralCode: string }>()
  const navigate = useNavigate()
  const { user, role, loading } = useAuth()
  const [status, setStatus] = useState<ActivationState>('idle')
  const [message, setMessage] = useState('')

  const normalizedCode = useMemo(() => referralCode.trim().toUpperCase(), [referralCode])

  useEffect(() => {
    if (normalizedCode) {
      window.localStorage.setItem(PENDING_REFERRAL_STORAGE_KEY, normalizedCode)
    }
  }, [normalizedCode])

  useEffect(() => {
    if (!normalizedCode || loading || !user || role !== 'client') {
      return
    }

    const runActivation = async () => {
      setStatus('loading')
      setMessage('Activation en cours...')

      try {
        const response = await activateReferralByCode(normalizedCode)
        window.localStorage.removeItem(PENDING_REFERRAL_STORAGE_KEY)
        setStatus('success')
        setMessage(response.message || 'Code de parrainage active avec succes.')
      } catch (error) {
        setStatus('error')
        setMessage(error instanceof Error ? error.message : 'Impossible d\'activer ce code.')
      }
    }

    runActivation().catch(() => null)
  }, [loading, normalizedCode, role, user])

  if (!normalizedCode) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
          <h1 className="font-display text-2xl font-extrabold text-dark">Code invalide</h1>
          <p className="mt-2 text-sm text-gray-600">Le lien de parrainage est incomplet.</p>
          <Link to="/dashboard" className="mt-4 inline-flex rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white">
            Retour au dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg items-center px-4 py-10">
      <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Parrainage LoyalUp</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-dark">Invitation recue</h1>
        <p className="mt-2 text-sm text-gray-600">
          Code: <span className="font-semibold text-gray-900">{normalizedCode}</span>
        </p>

        {!user ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-gray-700">Connectez-vous pour activer ce parrainage et debloquer votre bonus.</p>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white"
            >
              Se connecter
            </button>
          </div>
        ) : null}

        {user && role !== 'client' ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Le parrainage client est disponible uniquement pour les comptes client.
          </div>
        ) : null}

        {status === 'loading' ? (
          <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{message}</div>
        ) : null}

        {status === 'success' ? (
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>
            <Link to="/dashboard/gamification" className="inline-flex rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white">
              Voir mon espace fidelite
            </Link>
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</div>
        ) : null}
      </div>
    </div>
  )
}
