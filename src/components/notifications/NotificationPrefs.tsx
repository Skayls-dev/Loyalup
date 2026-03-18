import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../shared/lib/supabaseClient'

type NotificationPrefsProps = {
  userId: string
}

export type NotificationPrefsState = {
  pointsEarned: boolean
  challengesBadges: boolean
  tierUpgrade: boolean
  newMerchants: boolean
  streakReminders: boolean
  pushEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
}

type UseNotificationPrefsResult = {
  prefs: NotificationPrefsState
  loading: boolean
  saving: boolean
  error: string | null
  pushPermissionHint: string | null
  setPref: (key: keyof NotificationPrefsState, value: boolean) => void
}

type PrefsRow = {
  id: keyof NotificationPrefsState
  label: string
  description: string
}

const DEFAULT_PREFS: NotificationPrefsState = {
  pointsEarned: true,
  challengesBadges: true,
  tierUpgrade: true,
  newMerchants: true,
  streakReminders: true,
  pushEnabled: true,
  emailEnabled: false,
  smsEnabled: false,
}

const PUSH_EMAIL_ROWS: PrefsRow[] = [
  {
    id: 'pointsEarned',
    label: 'Points gagnés',
    description: 'À chaque transaction',
  },
  {
    id: 'challengesBadges',
    label: 'Défis & badges',
    description: 'Progression et complétion',
  },
  {
    id: 'tierUpgrade',
    label: 'Changement de niveau',
    description: 'Tier upgrade',
  },
  {
    id: 'newMerchants',
    label: 'Nouveaux marchands',
    description: 'Dans réseaux actifs',
  },
  {
    id: 'streakReminders',
    label: 'Rappels de streak',
    description: 'Avant expiration J-1',
  },
]

const CHANNEL_ROWS: PrefsRow[] = [
  {
    id: 'pushEnabled',
    label: 'Notifications push',
    description: 'Sur appareil',
  },
  {
    id: 'emailEnabled',
    label: 'Email',
    description: 'Résumé hebdomadaire',
  },
  {
    id: 'smsEnabled',
    label: 'SMS',
    description: 'Événements importants',
  },
]

function toDbPayload(prefs: NotificationPrefsState) {
  return {
    points_earned: prefs.pointsEarned,
    challenges_badges: prefs.challengesBadges,
    tier_upgrade: prefs.tierUpgrade,
    new_merchants: prefs.newMerchants,
    streak_reminders: prefs.streakReminders,
    push_enabled: prefs.pushEnabled,
    email_enabled: prefs.emailEnabled,
    sms_enabled: prefs.smsEnabled,
  }
}

function readBoolean(raw: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = raw[key]
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true' || normalized === '1') return true
      if (normalized === 'false' || normalized === '0') return false
    }
  }

  return fallback
}

function fromDbRow(row: Record<string, unknown> | null): NotificationPrefsState {
  if (!row) return DEFAULT_PREFS

  return {
    pointsEarned: readBoolean(row, ['points_earned', 'pointsEarned'], DEFAULT_PREFS.pointsEarned),
    challengesBadges: readBoolean(row, ['challenges_badges', 'challengesBadges'], DEFAULT_PREFS.challengesBadges),
    tierUpgrade: readBoolean(row, ['tier_upgrade', 'tierUpgrade'], DEFAULT_PREFS.tierUpgrade),
    newMerchants: readBoolean(row, ['new_merchants', 'newMerchants'], DEFAULT_PREFS.newMerchants),
    streakReminders: readBoolean(row, ['streak_reminders', 'streakReminders'], DEFAULT_PREFS.streakReminders),
    pushEnabled: readBoolean(row, ['push_enabled', 'pushEnabled'], DEFAULT_PREFS.pushEnabled),
    emailEnabled: readBoolean(row, ['email_enabled', 'emailEnabled'], DEFAULT_PREFS.emailEnabled),
    smsEnabled: readBoolean(row, ['sms_enabled', 'smsEnabled'], DEFAULT_PREFS.smsEnabled),
  }
}

async function requestPushPermission(): Promise<{ granted: boolean; hint: string | null }> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return {
      granted: false,
      hint: 'Notifications push non supportées sur ce navigateur',
    }
  }

  if (Notification.permission === 'granted') {
    return { granted: true, hint: null }
  }

  const result = await Notification.requestPermission()

  if (result === 'granted') {
    return { granted: true, hint: null }
  }

  return {
    granted: false,
    hint: 'Autorisez les notifications dans votre navigateur',
  }
}

export function useNotificationPrefs(userId: string): UseNotificationPrefsResult {
  const [prefs, setPrefs] = useState<NotificationPrefsState>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushPermissionHint, setPushPermissionHint] = useState<string | null>(null)

  const hydratedRef = useRef(false)
  const previousSerializedRef = useRef<string>('')

  useEffect(() => {
    const load = async () => {
      if (!userId) {
        setPrefs(DEFAULT_PREFS)
        setLoading(false)
        setError(null)
        hydratedRef.current = false
        previousSerializedRef.current = JSON.stringify(DEFAULT_PREFS)
        return
      }

      setLoading(true)
      setError(null)
      hydratedRef.current = false

      const { data, error: selectError } = await supabase
        .from('user_notification_prefs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle<Record<string, unknown>>()

      if (selectError && selectError.code !== 'PGRST116') {
        setError(selectError.message)
        setLoading(false)
        return
      }

      let resolvedRow = data ?? null

      if (!resolvedRow) {
        const defaultsPayload = {
          user_id: userId,
          ...toDbPayload(DEFAULT_PREFS),
        }

        const { data: inserted, error: insertError } = await supabase
          .from('user_notification_prefs')
          .insert(defaultsPayload)
          .select('*')
          .single<Record<string, unknown>>()

        if (insertError) {
          setError(insertError.message)
          setLoading(false)
          return
        }

        resolvedRow = inserted
      }

      const resolvedPrefs = fromDbRow(resolvedRow)
      setPrefs(resolvedPrefs)
      previousSerializedRef.current = JSON.stringify(resolvedPrefs)
      hydratedRef.current = true
      setLoading(false)
    }

    void load()
  }, [userId])

  useEffect(() => {
    if (!userId || !hydratedRef.current) return

    const serialized = JSON.stringify(prefs)
    if (serialized === previousSerializedRef.current) return

    const timeoutId = window.setTimeout(async () => {
      setSaving(true)
      setError(null)

      const { error: updateError } = await supabase
        .from('user_notification_prefs')
        .update(toDbPayload(prefs))
        .eq('user_id', userId)

      if (updateError) {
        setError(updateError.message)
      } else {
        previousSerializedRef.current = serialized
      }

      setSaving(false)
    }, 500)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [prefs, userId])

  const setPref = (key: keyof NotificationPrefsState, value: boolean) => {
    if (key !== 'pushEnabled') {
      setPrefs((prev) => ({ ...prev, [key]: value }))
      return
    }

    if (!value) {
      setPushPermissionHint(null)
      setPrefs((prev) => ({ ...prev, pushEnabled: false }))
      return
    }

    void (async () => {
      const permission = await requestPushPermission()
      if (!permission.granted) {
        setPushPermissionHint(permission.hint)
        setPrefs((prev) => ({ ...prev, pushEnabled: false }))
        return
      }

      setPushPermissionHint(null)
      setPrefs((prev) => ({ ...prev, pushEnabled: true }))
    })()
  }

  return {
    prefs,
    loading,
    saving,
    error,
    pushPermissionHint,
    setPref,
  }
}

function ToggleRow({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean
  label: string
  description: string
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[20px] w-[36px] flex-shrink-0 rounded-full transition ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}
        />
      </button>
    </div>
  )
}

function PrefSection({
  title,
  rows,
  prefs,
  setPref,
}: {
  title: string
  rows: PrefsRow[]
  prefs: NotificationPrefsState
  setPref: (key: keyof NotificationPrefsState, value: boolean) => void
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-2">
        {rows.map((row) => (
          <ToggleRow
            key={row.id}
            checked={prefs[row.id]}
            label={row.label}
            description={row.description}
            onChange={(next) => setPref(row.id, next)}
          />
        ))}
      </div>
    </section>
  )
}

export default function NotificationPrefs({ userId }: NotificationPrefsProps) {
  const { prefs, loading, saving, error, pushPermissionHint, setPref } = useNotificationPrefs(userId)

  const status = useMemo(() => {
    if (loading) return 'Chargement des préférences...'
    if (saving) return 'Enregistrement...'
    return null
  }, [loading, saving])

  return (
    <div className="space-y-4">
      <PrefSection title="Push & Email" rows={PUSH_EMAIL_ROWS} prefs={prefs} setPref={setPref} />
      <PrefSection title="Canaux" rows={CHANNEL_ROWS} prefs={prefs} setPref={setPref} />

      {status ? <p className="text-xs text-slate-500">{status}</p> : null}
      {pushPermissionHint ? <p className="text-xs text-amber-700">{pushPermissionHint}</p> : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  )
}
