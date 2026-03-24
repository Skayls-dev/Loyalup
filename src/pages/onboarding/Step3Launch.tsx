import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'
import { useOnboarding } from '../../contexts/OnboardingContext'

function localizedText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (value && typeof value === 'object') {
    const record = value as { fr?: unknown; en?: unknown }
    if (typeof record.fr === 'string' && record.fr.trim()) {
      return record.fr.trim()
    }
    if (typeof record.en === 'string' && record.en.trim()) {
      return record.en.trim()
    }
  }

  return fallback
}

export default function Step3Launch() {
  const navigate = useNavigate()
  const { selectedNetworkIds } = useOnboarding()
  const [networkNames, setNetworkNames] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function runMountTasks() {
      const { data: authData } = await supabase.auth.getUser()
      const userId = authData.user?.id

      const loadNetworkNames = async () => {
        if (selectedNetworkIds.length === 0) {
          if (!cancelled) {
            setNetworkNames([])
          }
          return
        }

        const { data } = await supabase
          .from('networks')
          .select('id, name')
          .in('id', selectedNetworkIds)

        if (cancelled) {
          return
        }

        const byId = new Map(
          ((data ?? []) as Array<{ id: string; name: unknown }>).map((row) => [
            row.id,
            localizedText(row.name, 'Réseau'),
          ]),
        )

        setNetworkNames(selectedNetworkIds.map((id) => byId.get(id) ?? 'Réseau'))
      }

      const creditWelcomeBonus = async () => {
        if (!userId) {
          return
        }

        for (const args of [{ userId }, { user_id: userId }, { p_user_id: userId }]) {
          const result = await supabase.rpc('credit_welcome_bonus', args)
          if (!result.error) {
            break
          }
        }
      }

      const enrollUserInNetworks = async () => {
        await Promise.all(
          selectedNetworkIds.map((networkId) =>
            supabase.functions
              .invoke('manage-client-enrollment', {
                method: 'POST',
                body: { action: 'ENROLL_CLIENT', network_id: networkId },
              })
              .catch(() => null),
          ),
        )
      }

      const markOnboardingComplete = async () => {
        await supabase.auth.updateUser({
          data: { onboarding_completed: true, onboarding_complete: true },
        })
      }

      const logAnalyticsEvent = async () => {
        if (!userId) {
          return
        }

        await supabase.from('user_events').insert({
          user_id: userId,
          session_id: crypto.randomUUID(),
          event_type: 'onboarding_completed',
          properties: { selected_networks: selectedNetworkIds, welcome_points: 250 },
          page: '/onboarding/3',
          app_version: 'web',
        })
      }

      await Promise.all([
        loadNetworkNames().catch(() => null),
        creditWelcomeBonus().catch(() => null),
        enrollUserInNetworks().catch(() => null),
        markOnboardingComplete().catch(() => null),
        logAnalyticsEvent().catch(() => null),
      ])
    }

    void runMountTasks()

    return () => {
      cancelled = true
    }
  }, [selectedNetworkIds])

  const networkPills = useMemo(
    () =>
      networkNames.map((name, index) => ({
        id: `${selectedNetworkIds[index] ?? index}`,
        emoji: '🌍',
        name,
      })),
    [networkNames, selectedNetworkIds],
  )

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <style>{`
        @keyframes popInSpring {
          0% { transform: scale(0.7); opacity: 0; }
          65% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: 'linear-gradient(135deg, #22C55E, #5B4FE8)',
          animation: 'popInSpring 650ms cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        }}
        className="flex h-20 w-20 items-center justify-center rounded-full text-4xl"
      >
        🎉
      </div>

      <h1 className="mt-5 font-display text-4xl font-extrabold text-dark">Vous êtes prêt !</h1>
      <p className="mt-2 font-body text-sm text-gray-600">
        Votre compte Looyaal est activé. Scannez votre premier QR pour commencer.
      </p>

      <article className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#5B4FE8] to-[#8B7FF5] px-5 py-4 text-left text-white">
        <p className="font-display text-2xl font-extrabold">+250 pts</p>
        <p className="mt-1 font-body text-sm font-semibold">Bonus de bienvenue</p>
        <p className="mt-1 font-body text-xs text-white/80">Valable 30 jours</p>
      </article>

      {selectedNetworkIds.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {networkPills.map((n) => (
            <span
              key={n.id}
              className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700"
            >
              {n.emoji} {n.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-8 w-full space-y-3">
        <button
          type="button"
          onClick={() => navigate('/scan')}
          className="h-11 w-full rounded-xl bg-[#5B4FE8] font-body text-sm font-semibold text-white"
        >
          📱 Scanner mon premier QR
        </button>
        <button
          type="button"
          onClick={() => navigate('/networks')}
          className="h-11 w-full rounded-xl border border-gray-200 bg-white font-body text-sm font-semibold text-gray-900"
        >
          🌍 Découvrir les réseaux
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="font-body text-sm text-gray-400 hover:text-gray-600"
        >
          Passer cette étape
        </button>
      </div>
    </section>
  )
}
