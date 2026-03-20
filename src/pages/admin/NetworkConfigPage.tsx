import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../shared/lib/supabaseClient'

type NetworkStatus = 'active' | 'paused' | 'draft'

type ConfigDraft = {
  name: string
  slug: string
  description: string
  primaryColor: string
  multiplier: number
  minPointsPerTransaction: number
  maxPointsPerDay: number
  pointsExpirationDays: number
  gamificationEnabled: boolean
  referralEnabled: boolean
  isPublic: boolean
  coalitionEnabled: boolean
}

type MemberItem = {
  id: string
  name: string
  points: number
  tier: string
}

type MerchantItem = {
  id: string
  name: string
  city: string
  emoji: string
  pointsPerDay: number
  status: string
}

type PartnerItem = {
  id: string
  name: string
  role: string
}

const colorSwatches = ['#5B4FE8', '#00C9A7', '#FF6B35', '#E24B4A', '#FFD23F', '#0EA5E9', '#8B5CF6']

const defaultDraft: ConfigDraft = {
  name: '',
  slug: '',
  description: '',
  primaryColor: '#5B4FE8',
  multiplier: 1,
  minPointsPerTransaction: 0,
  maxPointsPerDay: 0,
  pointsExpirationDays: 365,
  gamificationEnabled: true,
  referralEnabled: false,
  isPublic: true,
  coalitionEnabled: false,
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function localizedText(raw: unknown, fallback = ''): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const rec = raw as { fr?: unknown; en?: unknown }
    if (typeof rec.fr === 'string') return rec.fr
    if (typeof rec.en === 'string') return rec.en
  }
  return fallback
}

function statusMeta(status: NetworkStatus): { label: string; bg: string; color: string } {
  if (status === 'active') return { label: 'Actif', bg: '#E1F5EE', color: '#0F6E56' }
  if (status === 'paused') return { label: 'En pause', bg: '#F1F3F9', color: 'var(--g600)' }
  return { label: 'Brouillon', bg: '#FAEEDA', color: '#633806' }
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-left"
    >
      <span className="font-body text-sm text-gray-700">{label}</span>
      <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition ${checked ? 'bg-violet-600' : 'bg-gray-300'}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </span>
    </button>
  )
}

export default function NetworkConfigPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  const [draft, setDraft] = useState<ConfigDraft>(defaultDraft)
  const [status, setStatus] = useState<NetworkStatus>('draft')
  const [members, setMembers] = useState<MemberItem[]>([])
  const [merchants, setMerchants] = useState<MerchantItem[]>([])
  const [partners, setPartners] = useState<PartnerItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const networkRes = await supabase
        .from('networks')
        .select('id, slug, name, description, primary_color, points_multiplier, is_active, is_draft, is_public, coalition_enabled, provider_criteria')
        .eq('id', id)
        .maybeSingle()

      if (cancelled) return

      if (networkRes.error || !networkRes.data) {
        setLoading(false)
        setError(networkRes.error?.message ?? 'Réseau introuvable.')
        return
      }

      const network = networkRes.data as Record<string, unknown>
      const criteria = (network.provider_criteria && typeof network.provider_criteria === 'object'
        ? network.provider_criteria
        : {}) as Record<string, unknown>

      setDraft({
        name: localizedText(network.name, 'Réseau'),
        slug: String(network.slug ?? ''),
        description: localizedText(network.description, ''),
        primaryColor: typeof network.primary_color === 'string' ? network.primary_color : '#5B4FE8',
        multiplier: Number(network.points_multiplier ?? 1),
        minPointsPerTransaction: Number(criteria.min_points_per_transaction ?? 0),
        maxPointsPerDay: Number(criteria.max_points_per_day ?? 0),
        pointsExpirationDays: Number(criteria.points_expiration_days ?? 365),
        gamificationEnabled: Boolean(criteria.gamification_enabled ?? true),
        referralEnabled: Boolean(criteria.referral_enabled ?? false),
        isPublic: Boolean(network.is_public ?? true),
        coalitionEnabled: Boolean(network.coalition_enabled ?? false),
      })

      if (Boolean(network.is_draft)) {
        setStatus('draft')
      } else if (Boolean(network.is_active)) {
        setStatus('active')
      } else {
        setStatus('paused')
      }

      const [membersRes, merchantsRes, partnersRes] = await Promise.all([
        supabase
          .from('network_clients')
          .select('client_id, total_network_points')
          .eq('network_id', id)
          .order('total_network_points', { ascending: false })
          .limit(8),
        supabase
          .from('network_members')
          .select('fournisseur_id, status')
          .eq('network_id', id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('institution_network_access')
          .select('profile_id')
          .eq('network_id', id)
          .limit(8),
      ])

      if (cancelled) return

      const memberRows = (membersRes.data ?? []) as Array<{ client_id: string; total_network_points: number | null }>
      const memberIds = memberRows.map((row) => row.client_id)

      const [profilesRes, levelsRes] = await Promise.all([
        memberIds.length ? supabase.from('profiles').select('id, nom').in('id', memberIds) : Promise.resolve({ data: [], error: null }),
        memberIds.length ? supabase.from('client_levels').select('client_id, current_level').in('client_id', memberIds) : Promise.resolve({ data: [], error: null }),
      ])

      const profileMap = new Map<string, { nom?: string | null }>()
      for (const row of (profilesRes.data ?? []) as Array<{ id: string; nom?: string | null }>) {
        profileMap.set(row.id, { nom: row.nom ?? null })
      }

      const levelMap = new Map<string, number>()
      for (const row of (levelsRes.data ?? []) as Array<{ client_id: string; current_level: number | null }>) {
        levelMap.set(row.client_id, Number(row.current_level ?? 1))
      }

      setMembers(
        memberRows.map((row) => {
          const profile = profileMap.get(row.client_id)
          const level = levelMap.get(row.client_id) ?? 1
          const tier = level >= 8 ? 'Gold' : level >= 4 ? 'Silver' : 'Bronze'

          return {
            id: row.client_id,
            name: profile?.nom?.trim() || `Client ${row.client_id.slice(0, 6)}`,
            points: Number(row.total_network_points ?? 0),
            tier,
          }
        }),
      )

      const merchantRows = (merchantsRes.data ?? []) as Array<{ fournisseur_id: string; status: string | null }>
      const merchantIds = merchantRows.map((row) => row.fournisseur_id)

      const merchantsProfileRes = merchantIds.length
        ? await supabase.from('fournisseurs').select('id, nom_commerce, city').in('id', merchantIds)
        : { data: [], error: null }

      const merchantProfileMap = new Map<string, { nom_commerce?: string | null; city?: string | null }>()
      for (const row of (merchantsProfileRes.data ?? []) as Array<{ id: string; nom_commerce?: string | null; city?: string | null }>) {
        merchantProfileMap.set(row.id, row)
      }

      const daySince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const dailyPointsRes = merchantIds.length
        ? await supabase
            .from('transactions')
            .select('fournisseur_id, points_credited, created_at')
            .in('fournisseur_id', merchantIds)
            .gte('created_at', daySince)
        : { data: [], error: null }

      const dailyPointsMap = new Map<string, number>()
      for (const row of (dailyPointsRes.data ?? []) as Array<{ fournisseur_id: string; points_credited: number | null }>) {
        dailyPointsMap.set(row.fournisseur_id, (dailyPointsMap.get(row.fournisseur_id) ?? 0) + Number(row.points_credited ?? 0))
      }

      setMerchants(
        merchantRows.map((row) => {
          const details = merchantProfileMap.get(row.fournisseur_id)
          return {
            id: row.fournisseur_id,
            emoji: '🏪',
            name: details?.nom_commerce?.trim() || 'Marchand',
            city: details?.city?.trim() || 'N/A',
            pointsPerDay: dailyPointsMap.get(row.fournisseur_id) ?? 0,
            status: row.status === 'active' ? 'Actif' : row.status === 'pending' ? 'En attente' : 'En pause',
          }
        }),
      )

      const partnerRows = (partnersRes.data ?? []) as Array<{ profile_id: string }>
      const partnerIds = partnerRows.map((row) => row.profile_id)
      const partnerProfiles = partnerIds.length
        ? await supabase.from('profiles').select('id, nom, prenom, role').in('id', partnerIds)
        : { data: [], error: null }

      setPartners(
        ((partnerProfiles.data ?? []) as Array<{ id: string; nom?: string | null; prenom?: string | null; role?: string | null }>).map((row) => ({
          id: row.id,
          name: [row.prenom?.trim(), row.nom?.trim()].filter(Boolean).join(' ') || row.nom?.trim() || 'Institution',
          role: row.role || 'institution',
        })),
      )

      hydratedRef.current = true
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!hydratedRef.current || !id) return

    const timer = window.setTimeout(() => {
      void persistDraft(false)
    }, 1500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [draft, id, status])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const state = location.state as { toast?: unknown } | null
    if (state && typeof state.toast === 'string' && state.toast.trim()) {
      setToast(state.toast)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  const persistDraft = async (showToast: boolean) => {
    if (!id) return

    setSaving(true)
    setError(null)

    const payload = {
      slug: draft.slug.trim(),
      name: { fr: draft.name.trim(), en: draft.name.trim() },
      description: { fr: draft.description.trim(), en: draft.description.trim() },
      primary_color: draft.primaryColor,
      points_multiplier: Number(draft.multiplier.toFixed(1)),
      is_public: draft.isPublic,
      coalition_enabled: draft.coalitionEnabled,
      is_active: status === 'active',
      is_draft: status === 'draft',
      provider_criteria: {
        min_points_per_transaction: draft.minPointsPerTransaction,
        max_points_per_day: draft.maxPointsPerDay,
        points_expiration_days: draft.pointsExpirationDays,
        gamification_enabled: draft.gamificationEnabled,
        referral_enabled: draft.referralEnabled,
      },
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = await supabase.from('networks').update(payload).eq('id', id)

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    setSaving(false)
    if (showToast) {
      setToast('Sauvegardé ✓')
    }
  }

  const meta = useMemo(() => statusMeta(status), [status])

  const setName = (name: string) => {
    setDraft((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
    }))
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <button type="button" onClick={() => navigate('/admin/networks')} className="font-body text-sm text-gray-600 hover:text-dark">
            ← Retour
          </button>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold text-dark">{draft.name || 'Réseau'}</h1>
            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus((prev) => (prev === 'active' ? 'paused' : 'paused'))}
            className="h-10 rounded-md border border-gray-300 px-3 font-body text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            ⏸ Mettre en pause
          </button>
          <button
            type="button"
            onClick={() => {
              void persistDraft(true)
            }}
            className="h-10 rounded-md bg-primary px-3 font-body text-sm font-semibold text-white hover:brightness-105"
          >
            💾 Sauvegarder
          </button>
        </div>
      </header>

      {toast ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 font-body text-sm text-emerald-700">{toast}</p> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Identité du réseau</h2>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-body text-xs text-gray-600">Nom</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1 block font-body text-xs text-gray-600">Slug</span>
                <input
                  type="text"
                  value={draft.slug}
                  onChange={(event) => {
                    setSlugTouched(true)
                    setDraft((prev) => ({ ...prev, slug: slugify(event.target.value) }))
                  }}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block font-body text-xs text-gray-600">Description</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                className="min-h-[90px] w-full rounded-md border border-gray-300 px-3 py-2 font-body text-sm text-dark outline-none focus:border-primary"
              />
            </label>

            <div className="mt-3">
              <p className="mb-1 font-body text-xs text-gray-600">Couleur principale</p>
              <div className="flex flex-wrap gap-2">
                {colorSwatches.map((color) => {
                  const active = draft.primaryColor === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, primaryColor: color }))}
                      className={`h-8 w-8 rounded-full border-2 transition ${active ? 'scale-110 border-dark' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                      aria-label={`Choisir la couleur ${color}`}
                    />
                  )
                })}
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Règles de points</h2>

            <div className="mt-3 flex items-center gap-2">
              <span className="font-body text-sm text-gray-700">Multiplicateur</span>
              <div className="ml-auto inline-flex items-center rounded-full border border-gray-300 bg-white px-1 py-1">
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, multiplier: Math.max(1, Number((prev.multiplier - 0.1).toFixed(1))) }))}
                  className="h-7 w-7 rounded-full text-gray-700 hover:bg-gray-100"
                >
                  −
                </button>
                <span className="px-3 font-body text-sm font-semibold text-dark">x{draft.multiplier.toFixed(1)}</span>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, multiplier: Math.min(5, Number((prev.multiplier + 0.1).toFixed(1))) }))}
                  className="h-7 w-7 rounded-full text-gray-700 hover:bg-gray-100"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block font-body text-xs text-gray-600">Points minimum/transaction</span>
                <input
                  type="number"
                  min={0}
                  value={draft.minPointsPerTransaction}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minPointsPerTransaction: Number(event.target.value) }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-body text-xs text-gray-600">Points maximum/jour</span>
                <input
                  type="number"
                  min={0}
                  value={draft.maxPointsPerDay}
                  onChange={(event) => setDraft((prev) => ({ ...prev, maxPointsPerDay: Number(event.target.value) }))}
                  className="h-10 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 block font-body text-xs text-gray-600">Expiration des points en jours</span>
              <input
                type="number"
                min={1}
                value={draft.pointsExpirationDays}
                onChange={(event) => setDraft((prev) => ({ ...prev, pointsExpirationDays: Number(event.target.value) }))}
                className="h-10 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
              />
            </label>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Fonctionnalités</h2>
            <div className="mt-3 space-y-2">
              <ToggleRow label="Gamification activée" checked={draft.gamificationEnabled} onChange={(next) => setDraft((prev) => ({ ...prev, gamificationEnabled: next }))} />
              <ToggleRow label="Parrainage" checked={draft.referralEnabled} onChange={(next) => setDraft((prev) => ({ ...prev, referralEnabled: next }))} />
              <ToggleRow label="Accès public" checked={draft.isPublic} onChange={(next) => setDraft((prev) => ({ ...prev, isPublic: next }))} />
              <ToggleRow label="Coalition inter-réseaux" checked={draft.coalitionEnabled} onChange={(next) => setDraft((prev) => ({ ...prev, coalitionEnabled: next }))} />
            </div>
          </article>
        </div>

        <aside className="space-y-4">
          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">MembersTable</h3>
            <div className="mt-3 space-y-2">
              {members.slice(0, 6).map((member) => {
                const initials = member.name
                  .split(' ')
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')
                  .toUpperCase()

                return (
                  <div key={member.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">{initials || 'CL'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body text-sm font-semibold text-dark">{member.name}</p>
                    </div>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{member.tier}</span>
                    <span className="font-body text-xs font-semibold text-violet-700">{member.points.toLocaleString('fr-FR')}</span>
                  </div>
                )
              })}
              {members.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun membre.</p> : null}
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">ActiveMerchantsList</h3>
            <div className="mt-3 space-y-2">
              {merchants.slice(0, 6).map((merchant) => (
                <div key={merchant.id} className="flex items-center gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2">
                  <span className="text-sm">{merchant.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-semibold text-dark">{merchant.name}</p>
                    <p className="font-body text-xs text-gray-500">{merchant.city}</p>
                  </div>
                  <span className="font-body text-xs text-gray-600">{merchant.pointsPerDay.toLocaleString('fr-FR')} pts/j</span>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{merchant.status}</span>
                </div>
              ))}
              {merchants.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun marchand actif.</p> : null}
            </div>
          </article>

          <article className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">InstitutionalPartners</h3>
            <div className="mt-3 space-y-2">
              {partners.slice(0, 6).map((partner) => (
                <div key={partner.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-2.5 py-2">
                  <p className="truncate font-body text-sm font-semibold text-dark">{partner.name}</p>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">{partner.role}</span>
                </div>
              ))}

              <button
                type="button"
                onClick={() => navigate(`/admin/networks/${id}/partners/new`)}
                className="flex w-full items-center justify-center rounded-md border-2 border-dashed border-violet-300 bg-violet-50/30 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50"
              >
                Ajouter un partenaire
              </button>
            </div>
          </article>
        </aside>
      </div>

      {loading ? <p className="font-body text-sm text-gray-500">Chargement de la configuration...</p> : null}
      {saving ? <p className="font-body text-xs text-gray-500">Auto-save en cours...</p> : null}
      {error ? <p className="font-body text-sm text-rose-600">{error}</p> : null}
    </section>
  )
}
