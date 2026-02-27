import { useMemo, useState } from 'react'
import { createNetwork, updateNetwork } from '../../services/networkService'
import type { Network } from '../../types/networkTypes'

type BuilderStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

type BuilderDraft = {
  slug: string
  name: Record<string, string>
  tagline: Record<string, string>
  description: Record<string, string>
  category: string
  tags: string[]
  emoji: string
  primary_color: string
  secondary_color: string
  membership_type: 'open' | 'validated' | 'invite_only'
  requires_validation: boolean
  max_members: number | null
  provider_criteria: {
    min_tier: 'free' | 'starter' | 'premium' | 'enterprise'
    min_clients: number
  }
  points_multiplier: number
  multiplier_mode: 'additive' | 'compound'
  coalition_enabled: boolean
  transfer_rate: number
  platform_fee_pct: number
  welcome_bonus_points: number
  client_access: 'open' | 'invite' | 'level_required' | 'provider_only'
  min_level_required: number
  max_clients: number | null
  client_invite_code: string
  is_public: boolean
  is_featured: boolean
  show_member_map: boolean
  show_leaderboard: boolean
  show_member_count: boolean
  launched_at: string | null
  is_sponsored: boolean
  sponsor_name: string
  sponsor_logo_url: string
  sponsor_url: string
  contract_type: 'monthly' | 'annual' | 'per_transaction' | 'grant'
  contract_amount: number
  contract_currency: string
  sponsorship_starts_at: string | null
  sponsorship_ends_at: string | null
  is_draft: boolean
}

type NetworkBuilderProps = {
  mode?: 'create' | 'edit'
  initialNetwork?: Network | null
  onSaved?: (network: Network) => void
}

const STORAGE_KEY = 'network_builder_draft_v1'
const locales: Array<'fr' | 'en' | 'ar' | 'es' | 'nl'> = ['fr', 'en', 'ar', 'es', 'nl']

const categoryOptions = [
  'cultural',
  'environmental',
  'religious',
  'social',
  'geographic',
  'demographic',
  'professional',
  'educational',
  'custom',
] as const

function createInitialDraft(initialNetwork?: Network | null): BuilderDraft {
  if (initialNetwork) {
    return {
      slug: initialNetwork.slug,
      name: initialNetwork.name,
      tagline: initialNetwork.tagline ?? { fr: '', en: '', ar: '', es: '', nl: '' },
      description: initialNetwork.description ?? { fr: '', en: '', ar: '', es: '', nl: '' },
      category: initialNetwork.category,
      tags: initialNetwork.tags,
      emoji: initialNetwork.emoji,
      primary_color: initialNetwork.primary_color,
      secondary_color: initialNetwork.secondary_color ?? '',
      membership_type: initialNetwork.membership_type,
      requires_validation: true,
      max_members: null,
      provider_criteria: {
        min_tier: 'free',
        min_clients: 0,
      },
      points_multiplier: initialNetwork.points_multiplier,
      multiplier_mode: 'additive',
      coalition_enabled: initialNetwork.coalition_enabled,
      transfer_rate: initialNetwork.transfer_rate,
      platform_fee_pct: initialNetwork.platform_fee_pct,
      welcome_bonus_points: initialNetwork.welcome_bonus_points,
      client_access: initialNetwork.client_access,
      min_level_required: initialNetwork.min_level_required,
      max_clients: null,
      client_invite_code: '',
      is_public: initialNetwork.is_public,
      is_featured: initialNetwork.is_featured,
      show_member_map: true,
      show_leaderboard: true,
      show_member_count: true,
      launched_at: null,
      is_sponsored: false,
      sponsor_name: '',
      sponsor_logo_url: '',
      sponsor_url: '',
      contract_type: 'monthly',
      contract_amount: 0,
      contract_currency: 'EUR',
      sponsorship_starts_at: null,
      sponsorship_ends_at: null,
      is_draft: initialNetwork.is_draft,
    }
  }

  const fromStorage = localStorage.getItem(STORAGE_KEY)
  if (fromStorage) {
    try {
      return JSON.parse(fromStorage) as BuilderDraft
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    slug: '',
    name: { fr: '', en: '', ar: '', es: '', nl: '' },
    tagline: { fr: '', en: '', ar: '', es: '', nl: '' },
    description: { fr: '', en: '', ar: '', es: '', nl: '' },
    category: 'custom',
    tags: [],
    emoji: '✨',
    primary_color: '#4EA8DE',
    secondary_color: '#1f2937',
    membership_type: 'validated',
    requires_validation: true,
    max_members: null,
    provider_criteria: {
      min_tier: 'free',
      min_clients: 0,
    },
    points_multiplier: 1.2,
    multiplier_mode: 'additive',
    coalition_enabled: false,
    transfer_rate: 1,
    platform_fee_pct: 0.1,
    welcome_bonus_points: 0,
    client_access: 'open',
    min_level_required: 1,
    max_clients: null,
    client_invite_code: '',
    is_public: true,
    is_featured: false,
    show_member_map: true,
    show_leaderboard: true,
    show_member_count: true,
    launched_at: null,
    is_sponsored: false,
    sponsor_name: '',
    sponsor_logo_url: '',
    sponsor_url: '',
    contract_type: 'monthly',
    contract_amount: 0,
    contract_currency: 'EUR',
    sponsorship_starts_at: null,
    sponsorship_ends_at: null,
    is_draft: false,
  }
}

export function NetworkBuilder({ mode = 'create', initialNetwork = null, onSaved }: NetworkBuilderProps) {
  const [step, setStep] = useState<BuilderStep>(1)
  const [locale, setLocale] = useState<'fr' | 'en' | 'ar' | 'es' | 'nl'>('fr')
  const [draft, setDraft] = useState<BuilderDraft>(() => createInitialDraft(initialNetwork))
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canMoveNext = useMemo(() => {
    if (step === 1) {
      return Boolean(draft.name.fr.trim() && draft.emoji.trim() && draft.category)
    }

    if (step === 2) {
      return Boolean(draft.primary_color)
    }

    return true
  }, [draft.category, draft.emoji, draft.name.fr, draft.primary_color, step])

  const setAndPersistDraft = (next: BuilderDraft) => {
    setDraft(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const handleAutoSlug = () => {
    if (!draft.name.fr.trim()) {
      return
    }

    const slug = draft.name.fr
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    setAndPersistDraft({ ...draft, slug })
  }

  const nextStep = () => {
    if (step < 8 && canMoveNext) {
      setStep((step + 1) as BuilderStep)
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep((step - 1) as BuilderStep)
    }
  }

  const handleSave = async (publish: boolean) => {
    try {
      setSaving(true)
      setError(null)

      const payload = {
        ...draft,
        is_draft: !publish,
        is_active: publish,
        tags: draft.tags,
      }

      const result =
        mode === 'edit' && initialNetwork
          ? await updateNetwork(initialNetwork.id, payload)
          : await createNetwork(payload)

      localStorage.removeItem(STORAGE_KEY)
      onSaved?.(result)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Enregistrement impossible')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    const normalized = tagInput.trim().toLowerCase()
    if (!normalized || draft.tags.includes(normalized)) {
      setTagInput('')
      return
    }

    setAndPersistDraft({ ...draft, tags: [...draft.tags, normalized] })
    setTagInput('')
  }

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/90 p-4 text-zinc-100">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">Créateur de réseau</h2>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {Array.from({ length: 8 }).map((_, idx) => {
            const item = idx + 1
            return (
              <button
                key={item}
                type="button"
                onClick={() => setStep(item as BuilderStep)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                  step === item ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {item}
              </button>
            )
          })}
        </div>
      </header>

      {step === 1 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 1 — Identité</h3>
          <div className="flex gap-2">
            {locales.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`rounded px-2 py-1 text-xs ${locale === code ? 'bg-indigo-100 text-indigo-700' : 'bg-zinc-800 text-zinc-300'}`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <label className="block text-xs text-zinc-400">Nom ({locale})</label>
          <input
            value={draft.name[locale] ?? ''}
            onChange={(event) =>
              setAndPersistDraft({
                ...draft,
                name: { ...draft.name, [locale]: event.target.value },
              })
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />

          <label className="block text-xs text-zinc-400">Tagline ({locale})</label>
          <input
            value={draft.tagline[locale] ?? ''}
            onChange={(event) =>
              setAndPersistDraft({
                ...draft,
                tagline: { ...draft.tagline, [locale]: event.target.value },
              })
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />

          <label className="block text-xs text-zinc-400">Description ({locale})</label>
          <textarea
            value={draft.description[locale] ?? ''}
            onChange={(event) =>
              setAndPersistDraft({
                ...draft,
                description: { ...draft.description, [locale]: event.target.value },
              })
            }
            rows={4}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Slug</label>
              <div className="flex gap-2">
                <input
                  value={draft.slug}
                  onChange={(event) => setAndPersistDraft({ ...draft, slug: event.target.value.toLowerCase() })}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                />
                <button type="button" onClick={handleAutoSlug} className="rounded-lg bg-zinc-800 px-3 text-xs">
                    Générer
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-zinc-400">Category</label>
              <select
                value={draft.category}
                onChange={(event) => setAndPersistDraft({ ...draft, category: event.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addTag()
                  }
                }}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <button type="button" onClick={addTag} className="rounded-lg bg-zinc-800 px-3 text-xs">
                Ajouter
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {draft.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-200">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 2 — Identité visuelle</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Emoji</label>
              <input
                value={draft.emoji}
                onChange={(event) => setAndPersistDraft({ ...draft, emoji: event.target.value })}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Primary color</label>
              <input
                type="color"
                value={draft.primary_color}
                onChange={(event) => setAndPersistDraft({ ...draft, primary_color: event.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Secondary color</label>
              <input
                type="color"
                value={draft.secondary_color || '#1f2937'}
                onChange={(event) => setAndPersistDraft({ ...draft, secondary_color: event.target.value })}
                className="h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950"
              />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 p-4">
            <p className="text-xs text-zinc-500">Aperçu en direct</p>
            <div
              className="mt-2 rounded-xl p-4"
              style={{
                background: `linear-gradient(135deg, ${draft.primary_color}, ${draft.secondary_color || draft.primary_color})`,
              }}
            >
              <p className="text-lg font-semibold text-white">
                {draft.emoji} {draft.name.fr || 'Nom du réseau'}
              </p>
              <p className="text-sm text-white/80">{draft.tagline.fr || 'Tagline réseau'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 3 — Règles d’adhésion</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={draft.membership_type}
              onChange={(event) =>
                setAndPersistDraft({ ...draft, membership_type: event.target.value as BuilderDraft['membership_type'] })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="open">Ouvert</option>
              <option value="validated">Validé</option>
              <option value="invite_only">Sur invitation</option>
            </select>

            <input
              type="number"
              placeholder="Membres max"
              value={draft.max_members ?? ''}
              onChange={(event) =>
                setAndPersistDraft({ ...draft, max_members: event.target.value ? Number(event.target.value) : null })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />

            <select
              value={draft.provider_criteria.min_tier}
              onChange={(event) =>
                setAndPersistDraft({
                  ...draft,
                  provider_criteria: {
                    ...draft.provider_criteria,
                    min_tier: event.target.value as BuilderDraft['provider_criteria']['min_tier'],
                  },
                })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="free">gratuit</option>
              <option value="starter">starter</option>
              <option value="premium">premium</option>
              <option value="enterprise">entreprise</option>
            </select>

            <input
              type="number"
              placeholder="Clients min"
              value={draft.provider_criteria.min_clients}
              onChange={(event) =>
                setAndPersistDraft({
                  ...draft,
                  provider_criteria: {
                    ...draft.provider_criteria,
                    min_clients: Number(event.target.value || '0'),
                  },
                })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 4 — Économie des points</h3>
          <label className="block text-xs text-zinc-400">Multiplicateur : {draft.points_multiplier.toFixed(2)}x</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={draft.points_multiplier}
            onChange={(event) => setAndPersistDraft({ ...draft, points_multiplier: Number(event.target.value) })}
            className="w-full"
          />

          <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm">
            100 pts → {Math.floor(100 * draft.points_multiplier)} pts
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={draft.multiplier_mode}
              onChange={(event) =>
                setAndPersistDraft({ ...draft, multiplier_mode: event.target.value as BuilderDraft['multiplier_mode'] })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="additive">Additif</option>
              <option value="compound">Composé</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={draft.coalition_enabled}
                onChange={(event) => setAndPersistDraft({ ...draft, coalition_enabled: event.target.checked })}
              />
              Coalition active
            </label>
            <input
              type="number"
              step={0.05}
              min={0.5}
              max={1}
              value={draft.transfer_rate}
              onChange={(event) => setAndPersistDraft({ ...draft, transfer_rate: Number(event.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <input
              type="number"
              step={0.01}
              min={0}
              max={1}
              value={draft.platform_fee_pct}
              onChange={(event) => setAndPersistDraft({ ...draft, platform_fee_pct: Number(event.target.value) })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          </div>

          <input
            type="number"
            min={0}
            value={draft.welcome_bonus_points}
            onChange={(event) => setAndPersistDraft({ ...draft, welcome_bonus_points: Number(event.target.value || '0') })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Points de bonus de bienvenue"
          />
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 5 — Accès client</h3>
          <select
            value={draft.client_access}
            onChange={(event) =>
              setAndPersistDraft({ ...draft, client_access: event.target.value as BuilderDraft['client_access'] })
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="open">Ouvert</option>
            <option value="invite">Code d’invitation</option>
            <option value="level_required">Niveau requis</option>
            <option value="provider_only">Commerçants uniquement</option>
          </select>

          {draft.client_access === 'invite' ? (
            <input
              value={draft.client_invite_code}
              onChange={(event) => setAndPersistDraft({ ...draft, client_invite_code: event.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Code d’invitation client"
            />
          ) : null}

          {draft.client_access === 'level_required' ? (
            <input
              type="number"
              min={1}
              max={10}
              value={draft.min_level_required}
              onChange={(event) => setAndPersistDraft({ ...draft, min_level_required: Number(event.target.value || '1') })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
          ) : null}

          <input
            type="number"
            placeholder="Clients max"
            value={draft.max_clients ?? ''}
            onChange={(event) =>
              setAndPersistDraft({ ...draft, max_clients: event.target.value ? Number(event.target.value) : null })
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {step === 6 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 6 — Visibilité</h3>
          {[
            ['Public', 'is_public'],
            ['Mis en avant', 'is_featured'],
            ['Afficher la carte des membres', 'show_member_map'],
            ['Afficher le classement', 'show_leaderboard'],
            ['Afficher le nombre de membres', 'show_member_count'],
          ].map(([label, key]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={Boolean(draft[key as keyof BuilderDraft])}
                onChange={(event) =>
                  setAndPersistDraft({ ...draft, [key]: event.target.checked } as BuilderDraft)
                }
              />
              {label}
            </label>
          ))}

          <input
            type="datetime-local"
            value={draft.launched_at ?? ''}
            onChange={(event) => setAndPersistDraft({ ...draft, launched_at: event.target.value || null })}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {step === 7 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 7 — Sponsoring</h3>
          <label className="inline-flex items-center gap-2 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={draft.is_sponsored}
              onChange={(event) => setAndPersistDraft({ ...draft, is_sponsored: event.target.checked })}
            />
            Sponsorisé
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={draft.sponsor_name}
              onChange={(event) => setAndPersistDraft({ ...draft, sponsor_name: event.target.value })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Nom du sponsor"
            />
            <input
              value={draft.sponsor_url}
              onChange={(event) => setAndPersistDraft({ ...draft, sponsor_url: event.target.value })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="URL du sponsor"
            />
            <select
              value={draft.contract_type}
              onChange={(event) =>
                setAndPersistDraft({ ...draft, contract_type: event.target.value as BuilderDraft['contract_type'] })
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            >
              <option value="monthly">mensuel</option>
              <option value="annual">annuel</option>
              <option value="per_transaction">par transaction</option>
              <option value="grant">subvention</option>
            </select>
            <input
              type="number"
              min={0}
              value={draft.contract_amount}
              onChange={(event) => setAndPersistDraft({ ...draft, contract_amount: Number(event.target.value || '0') })}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              placeholder="Montant du contrat"
            />
          </div>
        </div>
      ) : null}

      {step === 8 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Étape 8 — Revue et publication</h3>
          <div className="rounded-xl border border-zinc-700 bg-zinc-950 p-4 text-sm">
            <p className="text-zinc-200">{draft.emoji} {draft.name.fr || 'Sans nom'}</p>
            <p className="text-zinc-400">Slug: {draft.slug || '-'}</p>
            <p className="text-zinc-400">Catégorie : {draft.category}</p>
            <p className="text-zinc-400">Multiplicateur : {draft.points_multiplier.toFixed(2)}x</p>
            <p className="text-zinc-400">Adhésion : {draft.membership_type}</p>
            <p className="text-zinc-400">Accès client : {draft.client_access}</p>
          </div>
        </div>
      ) : null}

      {error ? <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={prevStep} disabled={step === 1} className="rounded-lg bg-zinc-800 px-3 py-2 text-xs">
          Précédent
        </button>

        <div className="flex items-center gap-2">
          {step < 8 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={!canMoveNext}
              className="rounded-lg bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-60"
            >
              Suivant
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  void handleSave(false)
                }}
                disabled={saving}
                className="rounded-lg bg-zinc-800 px-3 py-2 text-xs"
              >
                Sauvegarder brouillon
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave(true)
                }}
                disabled={saving}
                className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950"
              >
                Publier
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  )
}
