import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

type SelectedNetwork = {
  id: string
  name: string
  emoji: string
}

function localizedText(raw: unknown, fallback = ''): string {
  if (typeof raw === 'string' && raw.trim()) return raw
  if (raw && typeof raw === 'object') {
    const rec = raw as { fr?: unknown; en?: unknown }
    if (typeof rec.fr === 'string' && rec.fr.trim()) return rec.fr
    if (typeof rec.en === 'string' && rec.en.trim()) return rec.en
  }
  return fallback
}

export default function Step5Success() {
  const navigate = useNavigate()
  const { selectedNetworkIds } = useOnboarding()

  const [networkPreview, setNetworkPreview] = useState<SelectedNetwork[]>([])
  const [error, setError] = useState<string | null>(null)

  const hasSelectedNetworks = selectedNetworkIds.length > 0

  useEffect(() => {
    let cancelled = false

    async function hydratePreview() {
      if (!hasSelectedNetworks) {
        setNetworkPreview([])
        return
      }

      const { data, error: loadError } = await supabase
        .from('networks')
        .select('id, name, emoji')
        .in('id', selectedNetworkIds)

      if (cancelled) return

      if (loadError) {
        setNetworkPreview([])
        return
      }

      const mapped = (data ?? []).map((row) => ({
        id: String((row as { id: unknown }).id),
        name: localizedText((row as { name?: unknown }).name, 'Réseau'),
        emoji: String((row as { emoji?: unknown }).emoji ?? '🌐'),
      }))

      const order = new Map(selectedNetworkIds.map((id, index) => [id, index]))
      mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

      setNetworkPreview(mapped)
    }

    async function runMountActions() {
      setError(null)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        setError(authError?.message ?? 'Utilisateur introuvable.')
        return
      }

      const userId = authData.user.id

      // 1) Credit welcome points (best-effort with signature fallbacks).
      const rpcCandidates: Array<Record<string, unknown>> = [
        { userId },
        { user_id: userId },
        { p_user_id: userId },
      ]

      let creditDone = false
      for (const args of rpcCandidates) {
        const rpcResult = await supabase.rpc('credit_welcome_bonus', args)
        if (!rpcResult.error) {
          creditDone = true
          break
        }
      }

      if (!creditDone) {
        // Non-blocking: onboarding success screen should still work.
        console.warn('[Step5Success] credit_welcome_bonus failed for all signatures')
      }

      // 2) Mark onboarding complete in auth metadata.
      const { error: updateUserError } = await supabase.auth.updateUser({
        data: {
          ...(authData.user.user_metadata ?? {}),
          onboarding_completed: true,
          onboarding_complete: true,
        },
      })

      if (updateUserError) {
        setError(updateUserError.message)
      }

      // 3) Log onboarding_completed event to analytics table.
      const sessionId =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `session-${Math.random().toString(36).slice(2)}`

      const analyticsInsert = await supabase.from('user_events').insert({
        user_id: userId,
        session_id: sessionId,
        event_type: 'onboarding_completed',
        properties: {
          selected_networks: selectedNetworkIds,
          welcome_points: 250,
        },
        page: '/onboarding/success',
        app_version: 'web',
      })

      if (analyticsInsert.error) {
        console.warn('[Step5Success] Failed to log onboarding_completed:', analyticsInsert.error.message)
      }
    }

    void Promise.all([hydratePreview(), runMountActions()])

    return () => {
      cancelled = true
    }
  }, [hasSelectedNetworks, selectedNetworkIds])

  const networkPills = useMemo(() => {
    if (networkPreview.length > 0) return networkPreview
    return selectedNetworkIds.map((id) => ({ id, emoji: '🌐', name: `Réseau ${id.slice(0, 6)}` }))
  }, [networkPreview, selectedNetworkIds])

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
      <style>{`
        @keyframes popInSpring {
          0% { transform: scale(0.7); opacity: 0; }
          65% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
        style={{
          background: 'linear-gradient(135deg, #22C55E, #5B4FE8)',
          animation: 'popInSpring 650ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        }}
      >
        🎉
      </div>

      <h1 className="mt-5 font-display text-4xl font-extrabold text-dark">Bienvenue sur LoyalUp !</h1>
      <p className="mt-2 max-w-xl font-body text-sm text-gray-600">
        Votre espace est prêt. Vous pouvez maintenant découvrir vos récompenses personnalisées.
      </p>

      <article
        className="mt-6 w-full max-w-xl rounded-2xl px-5 py-4 text-left text-white"
        style={{ background: 'linear-gradient(135deg, #5B4FE8, #7A6CFF)' }}
      >
        <p className="font-display text-2xl font-extrabold">+250 pts</p>
        <p className="mt-1 font-body text-sm font-semibold">Bonus de bienvenue</p>
        <p className="mt-1 font-body text-xs text-white/90">Valable 30 jours</p>
      </article>

      <div className="mt-6 w-full max-w-xl text-left">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Réseaux sélectionnés</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {networkPills.length === 0 ? (
            <span className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-600">
              Aucun réseau sélectionné
            </span>
          ) : (
            networkPills.map((network) => (
              <span
                key={network.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
              >
                <span aria-hidden="true">{network.emoji}</span>
                {network.name}
              </span>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 w-full max-w-xl text-left">
        <p className="font-body text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Prochaines étapes</p>
        <ul className="mt-3 space-y-2">
          {[
            'Explorez vos offres recommandées selon vos intérêts.',
            'Scannez votre premier QR code pour gagner des points.',
            'Activez vos notifications pour ne rater aucun défi.',
          ].map((item, index) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                {index + 1}
              </span>
              <span className="font-body text-sm text-gray-700">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {error ? <p className="mt-4 font-body text-sm text-rose-600">{error}</p> : null}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="h-11 rounded-xl bg-[#5B4FE8] px-5 font-body text-sm font-semibold text-white transition hover:brightness-105"
        >
          Accéder à mon dashboard →
        </button>

        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('loyalup:start-joyride'))
          }}
          className="font-body text-sm font-semibold text-violet-700 underline-offset-2 transition hover:underline"
        >
          Faire une visite guidée
        </button>
      </div>
    </section>
  )
}
