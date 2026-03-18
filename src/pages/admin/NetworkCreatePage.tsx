import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '../../shared/lib/supabaseClient'
import { useAuth } from '../../modules/auth/hooks/useAuth'

const thematicOptions = [
  'Géographique/Diaspora',
  'Sectoriel',
  'Valeurs/Engagements',
  'Local/Quartier',
  'Institutionnel',
] as const

const accessOptions = ['Public', 'Sur invitation', 'Validation manuelle'] as const

const schema = z.object({
  name: z.string().trim().min(3, 'Minimum 3 caractères').max(60, 'Maximum 60 caractères'),
  thematic: z.enum(thematicOptions),
  description: z.string().max(500, 'Maximum 500 caractères'),
  multiplier: z.number().min(1.0, 'Min 1.0').max(5.0, 'Max 5.0'),
  access: z.enum(accessOptions),
})

type FormValues = z.infer<typeof schema>

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function localizedText(raw: unknown): string {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const val = raw as { fr?: unknown; en?: unknown }
    if (typeof val.fr === 'string') return val.fr
    if (typeof val.en === 'string') return val.en
  }
  return ''
}

function mapThematicToCategory(thematic: (typeof thematicOptions)[number]): { category: string; emoji: string; tags: string[] } {
  if (thematic === 'Géographique/Diaspora') return { category: 'geographic', emoji: '🌍', tags: ['geographique', 'diaspora'] }
  if (thematic === 'Sectoriel') return { category: 'professional', emoji: '🏢', tags: ['sectoriel'] }
  if (thematic === 'Valeurs/Engagements') return { category: 'social', emoji: '🤝', tags: ['valeurs', 'engagements'] }
  if (thematic === 'Local/Quartier') return { category: 'geographic', emoji: '🏘️', tags: ['local', 'quartier'] }
  return { category: 'custom', emoji: '🏛️', tags: ['institutionnel'] }
}

function mapAccess(access: (typeof accessOptions)[number]) {
  if (access === 'Public') {
    return {
      membership_type: 'open',
      requires_validation: false,
      client_access: 'open',
      is_public: true,
    }
  }

  if (access === 'Sur invitation') {
    return {
      membership_type: 'invite_only',
      requires_validation: false,
      client_access: 'invite',
      is_public: false,
    }
  }

  return {
    membership_type: 'validated',
    requires_validation: true,
    client_access: 'open',
    is_public: false,
  }
}

async function insertDefaultTiers(networkId: string) {
  const defaults = [
    { label: 'Bronze', min_points: 0 },
    { label: 'Silver', min_points: 1000 },
    { label: 'Gold', min_points: 5000 },
    { label: 'Platinum', min_points: 10000 },
  ]

  const firstTry = await supabase.from('tiers').insert(defaults.map((tier) => ({ ...tier, network_id: networkId })))
  if (!firstTry.error) return

  const secondTry = await supabase.from('tiers').insert(defaults)
  if (!secondTry.error) return

  throw new Error(secondTry.error.message || firstTry.error.message)
}

export default function NetworkCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      thematic: 'Géographique/Diaspora',
      description: '',
      multiplier: 1.5,
      access: 'Public',
    },
    mode: 'onBlur',
  })

  const nameValue = watch('name')
  const slugPreview = useMemo(() => slugify(nameValue || ''), [nameValue])

  const onSubmit = async (values: FormValues) => {
    setServerError(null)

    const slug = slugify(values.name)
    if (!slug) {
      setError('name', { type: 'manual', message: 'Nom invalide pour générer un slug' })
      return
    }

    const [slugExistsRes, namesRes] = await Promise.all([
      supabase.from('networks').select('id').eq('slug', slug).limit(1),
      supabase.from('networks').select('id, name').limit(1000),
    ])

    if (slugExistsRes.error) {
      setServerError(slugExistsRes.error.message)
      return
    }

    if ((slugExistsRes.data ?? []).length > 0) {
      setError('name', { type: 'manual', message: 'Un réseau avec ce nom existe déjà' })
      return
    }

    if (namesRes.error) {
      setServerError(namesRes.error.message)
      return
    }

    const normalizedInputName = values.name.trim().toLowerCase()
    const duplicateName = (namesRes.data ?? []).some((row) => localizedText(row.name).trim().toLowerCase() === normalizedInputName)

    if (duplicateName) {
      setError('name', { type: 'manual', message: 'Un réseau avec ce nom existe déjà' })
      return
    }

    const thematic = mapThematicToCategory(values.thematic)
    const access = mapAccess(values.access)

    const { data, error } = await supabase
      .from('networks')
      .insert({
        slug,
        name: { fr: values.name.trim(), en: values.name.trim() },
        description: values.description?.trim()
          ? { fr: values.description.trim(), en: values.description.trim() }
          : { fr: '', en: '' },
        emoji: thematic.emoji,
        primary_color: '#5B4FE8',
        secondary_color: '#00C9A7',
        category: thematic.category,
        tags: thematic.tags,
        points_multiplier: Number(values.multiplier.toFixed(1)),
        provider_criteria: {},
        created_by: user?.id ?? null,
        is_active: true,
        is_draft: false,
        ...access,
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      setServerError(error?.message ?? 'Impossible de créer le réseau.')
      return
    }

    try {
      await insertDefaultTiers(data.id)
    } catch (tierError) {
      setServerError(tierError instanceof Error ? tierError.message : 'Impossible de créer les paliers par défaut.')
      return
    }

    navigate(`/admin/networks/${data.id}`, { state: { toast: 'Réseau créé ✓' } })
  }

  return (
    <section className="py-8">
      <div className="mx-auto w-full max-w-[600px]">
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h1 className="font-display text-3xl font-extrabold text-dark">Créer un réseau</h1>
          <p className="mt-1 font-body text-sm text-gray-600">Paramétrez les informations de base pour lancer le réseau.</p>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Nom du réseau *</span>
              <input
                type="text"
                {...register('name')}
                className="h-11 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
                placeholder="Ex: Diaspora Afrique de l'Ouest"
              />
              {errors.name ? <p className="mt-1 font-body text-xs text-rose-600">{errors.name.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Slug auto-généré</span>
              <input
                type="text"
                value={slugPreview}
                readOnly
                className="h-11 w-full rounded-md border border-gray-200 bg-gray-50 px-3 font-body text-sm text-gray-600"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Thématique *</span>
              <select
                {...register('thematic')}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 font-body text-sm text-dark outline-none focus:border-primary"
              >
                {thematicOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.thematic ? <p className="mt-1 font-body text-xs text-rose-600">{errors.thematic.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Description</span>
              <textarea
                rows={3}
                {...register('description')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-body text-sm text-dark outline-none focus:border-primary"
                placeholder="Résumé court de la mission du réseau"
              />
              {errors.description ? <p className="mt-1 font-body text-xs text-rose-600">{errors.description.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Multiplicateur de départ</span>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                {...register('multiplier', { valueAsNumber: true })}
                className="h-11 w-full rounded-md border border-gray-300 px-3 font-body text-sm text-dark outline-none focus:border-primary"
              />
              {errors.multiplier ? <p className="mt-1 font-body text-xs text-rose-600">{errors.multiplier.message}</p> : null}
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs font-semibold uppercase tracking-[0.12em] text-gray-500">Accès</span>
              <select
                {...register('access')}
                className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 font-body text-sm text-dark outline-none focus:border-primary"
              >
                {accessOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.access ? <p className="mt-1 font-body text-xs text-rose-600">{errors.access.message}</p> : null}
            </label>

            {serverError ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 font-body text-sm text-rose-700">{serverError}</p> : null}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="h-11 rounded-md border border-gray-300 bg-white px-4 font-body text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 rounded-md bg-primary px-4 font-body text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? 'Création...' : 'Créer le réseau →'}
              </button>
            </div>
          </form>
        </article>
      </div>
    </section>
  )
}
