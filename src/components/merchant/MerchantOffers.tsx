import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { useMerchantOffers, type MerchantOffer, type MerchantOfferStatus } from '../../hooks/useMerchantOffers'
import { supabase } from '../../shared/lib/supabaseClient'

export interface MerchantOffersProps {
  merchantId: string
  className?: string
}

type NetworkOption = {
  id: string
  name: string
}

type OfferCategoryStyle = {
  emoji: string
  bgClass: string
}

type OfferFormState = {
  name: string
  description: string
  points_required: number
  expiry_date: string
  category: string
  network_ids: string[]
}

const statusMeta: Record<MerchantOfferStatus, { label: string; badgeClass: string; rowClass: string; canHover: boolean }> = {
  active: {
    label: '● Actif',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    rowClass: '',
    canHover: true,
  },
  expired: {
    label: '● Expiré',
    badgeClass: 'bg-gray-100 text-gray-500',
    rowClass: 'opacity-60',
    canHover: false,
  },
  paused: {
    label: '● En pause',
    badgeClass: 'bg-amber-50 text-amber-700',
    rowClass: '',
    canHover: false,
  },
}

const categoryStyles: Record<string, OfferCategoryStyle> = {
  food: { emoji: '🍽️', bgClass: 'bg-orange-100 text-orange-700' },
  beverage: { emoji: '🥤', bgClass: 'bg-sky-100 text-sky-700' },
  retail: { emoji: '🛍️', bgClass: 'bg-pink-100 text-pink-700' },
  beauty: { emoji: '💄', bgClass: 'bg-rose-100 text-rose-700' },
  service: { emoji: '🛠️', bgClass: 'bg-indigo-100 text-indigo-700' },
  default: { emoji: '🎁', bgClass: 'bg-violet-100 text-violet-700' },
}

const categoryOptions = [
  { value: 'food', label: 'Food' },
  { value: 'beverage', label: 'Beverage' },
  { value: 'retail', label: 'Retail' },
  { value: 'beauty', label: 'Beauty' },
  { value: 'service', label: 'Service' },
]

const initialFormState: OfferFormState = {
  name: '',
  description: '',
  points_required: 100,
  expiry_date: '',
  category: 'food',
  network_ids: [],
}

function categoryMeta(category: string | null): OfferCategoryStyle {
  if (!category) return categoryStyles.default
  return categoryStyles[category.toLowerCase()] ?? categoryStyles.default
}

function formatStatus(status: MerchantOfferStatus) {
  return statusMeta[status]
}

function toLocalDateInput(dateIso: string | null): string {
  if (!dateIso) return ''
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function MerchantOffers({ merchantId, className = '' }: MerchantOffersProps) {
  const { offers: fetchedOffers, loading, error } = useMerchantOffers(merchantId)
  const [offers, setOffers] = useState<MerchantOffer[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [networks, setNetworks] = useState<NetworkOption[]>([])
  const [form, setForm] = useState<OfferFormState>(initialFormState)

  useEffect(() => {
    setOffers(fetchedOffers)
  }, [fetchedOffers])

  useEffect(() => {
    if (!merchantId) {
      setNetworks([])
      return
    }

    let cancelled = false

    async function loadNetworks() {
      const { data, error: networksError } = await supabase
        .from('merchant_networks')
        .select('network_id, networks:network_id(name)')
        .eq('merchant_id', merchantId)

      if (cancelled) {
        return
      }

      if (networksError) {
        setNetworks([])
        return
      }

      const mapped = ((data ?? []) as Array<{ network_id: string; networks?: unknown }>).map((row) => {
        const raw = row.networks as unknown
        const first = Array.isArray(raw) ? raw[0] : raw
        const name = first && typeof first === 'object' ? (first as { name?: string }).name : undefined

        return {
          id: row.network_id,
          name: name?.trim() || 'Reseau LoyalUp',
        }
      })

      setNetworks(mapped)
    }

    void loadNetworks()

    return () => {
      cancelled = true
    }
  }, [merchantId])

  const openModal = () => {
    setForm(initialFormState)
    setSubmitError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setSubmitError(null)
  }

  const onToggleNetwork = (networkId: string) => {
    setForm((prev) => {
      const exists = prev.network_ids.includes(networkId)
      return {
        ...prev,
        network_ids: exists ? prev.network_ids.filter((id) => id !== networkId) : [...prev.network_ids, networkId],
      }
    })
  }

  const canSubmit = useMemo(() => form.name.trim().length > 0 && form.points_required > 0 && !saving, [form.name, form.points_required, saving])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !merchantId) {
      return
    }

    setSaving(true)
    setSubmitError(null)

    const tempId = `temp-${Date.now()}`
    const optimisticOffer: MerchantOffer = {
      id: tempId,
      merchant_id: merchantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      points_required: Number(form.points_required),
      expiry_date: form.expiry_date || null,
      category: form.category,
      status: 'active',
      redemptions_this_month: 0,
      network_ids: [...form.network_ids],
      created_at: new Date().toISOString(),
    }

    setOffers((prev) => [optimisticOffer, ...prev])

    const payload = {
      merchant_id: merchantId,
      name: optimisticOffer.name,
      description: optimisticOffer.description,
      points_required: optimisticOffer.points_required,
      expiry_date: optimisticOffer.expiry_date,
      category: optimisticOffer.category,
      network_ids: optimisticOffer.network_ids,
      status: 'active',
      redemptions_this_month: 0,
    }

    const { data, error: insertError } = await supabase
      .from('merchant_offers')
      .insert(payload)
      .select('*')
      .single()

    if (insertError || !data) {
      setOffers((prev) => prev.filter((offer) => offer.id !== tempId))
      setSaving(false)
      setSubmitError(insertError?.message || 'Impossible de creer cette offre pour le moment.')
      return
    }

    const inserted = data as MerchantOffer & { status?: string | null }
    const isExpired = inserted.expiry_date ? new Date(inserted.expiry_date).getTime() < Date.now() : false
    const normalizedStatus: MerchantOfferStatus = inserted.status === 'paused' ? 'paused' : inserted.status === 'expired' || isExpired ? 'expired' : 'active'

    const finalOffer: MerchantOffer = {
      id: inserted.id,
      merchant_id: inserted.merchant_id,
      name: inserted.name,
      description: inserted.description,
      points_required: Number(inserted.points_required ?? 0),
      expiry_date: inserted.expiry_date,
      category: inserted.category,
      status: normalizedStatus,
      redemptions_this_month: Number((inserted as { redemptions_this_month?: number | null }).redemptions_this_month ?? 0),
      network_ids: Array.isArray(inserted.network_ids) ? inserted.network_ids : [],
      created_at: inserted.created_at,
    }

    setOffers((prev) => [finalOffer, ...prev.filter((offer) => offer.id !== tempId)])
    setSaving(false)
    setModalOpen(false)
    setForm(initialFormState)
  }

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Offres recompenses</p>
        <Button variant="ghost" size="sm" className="border border-gray-200 text-gray-700" onClick={openModal}>
          + Nouvelle offre
        </Button>
      </header>

      {modalOpen ? (
        <div className="mb-4 min-h-[260px] rounded-lg border border-violet-200 bg-violet-50/45 p-4">
          <h3 className="font-display text-lg font-bold text-dark">Creer une offre</h3>
          <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block md:col-span-2">
              <span className="mb-1 block font-body text-xs text-gray-600">Nom</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                placeholder="Ex: Cafe offert"
                required
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block font-body text-xs text-gray-600">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="min-h-[84px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                placeholder="Details de l'offre"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Points requis</span>
              <input
                type="number"
                min={1}
                value={form.points_required}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    points_required: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Date d'expiration</span>
              <input
                type="date"
                value={toLocalDateInput(form.expiry_date)}
                onChange={(event) => setForm((prev) => ({ ...prev, expiry_date: event.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Categorie</span>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="md:col-span-2">
              <legend className="mb-1 block font-body text-xs text-gray-600">Networks</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {networks.map((network) => (
                  <label key={network.id} className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={form.network_ids.includes(network.id)}
                      onChange={() => onToggleNetwork(network.id)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="font-body text-sm text-gray-700">{network.name}</span>
                  </label>
                ))}
                {networks.length === 0 ? <p className="font-body text-xs text-gray-500">Aucun reseau disponible.</p> : null}
              </div>
            </fieldset>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="submit" size="sm" loading={saving} disabled={!canSubmit}>
                Creer
              </Button>
              <Button type="button" variant="ghost" size="sm" className="border border-gray-200 text-gray-700" onClick={closeModal}>
                Annuler
              </Button>
            </div>

            {submitError ? <p className="md:col-span-2 font-body text-xs text-rose-600">{submitError}</p> : null}
          </form>
        </div>
      ) : null}

      <div className="space-y-2">
        {offers.map((offer) => {
          const status = formatStatus(offer.status)
          const icon = categoryMeta(offer.category)
          const rowHover = status.canHover ? 'hover:border-violet-400 hover:bg-violet-50/50' : ''

          return (
            <article
              key={offer.id}
              className={`flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 transition ${status.rowClass} ${rowHover}`}
            >
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base ${icon.bgClass}`}>{icon.emoji}</span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-dark">{offer.name}</p>
                <p className="mt-0.5 truncate font-body text-xs text-gray-500">
                  {offer.points_required.toLocaleString('fr-FR')} pts requis · {offer.redemptions_this_month.toLocaleString('fr-FR')} rachats ce mois
                </p>
              </div>

              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
            </article>
          )
        })}

        {!loading && offers.length === 0 ? <p className="pt-2 font-body text-sm text-gray-500">Aucune offre pour le moment.</p> : null}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
