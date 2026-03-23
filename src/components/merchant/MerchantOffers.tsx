import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Globe, MapPin } from 'lucide-react'
import { Button } from '../../components/ui'
import { useMerchantOffers, type MerchantOffer, type MerchantOfferStatus } from '../../hooks/useMerchantOffers'
import { ConfirmModal } from '../../shared/components/ConfirmModal'
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
  reward_delivery_type: 'in_store' | 'digital_code'
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
  reward_delivery_type: 'in_store',
  category: 'food',
  network_ids: [],
}

function categoryMeta(category: string | null): OfferCategoryStyle {
  if (!category) return categoryStyles.default
  return categoryStyles[category.toLowerCase()] ?? categoryStyles.default
}

function categoryValue(category: string | null): string {
  if (!category) return initialFormState.category

  const normalized = category.toLowerCase()
  if (categoryStyles[normalized]) {
    return normalized
  }

  const match = Object.entries(categoryStyles).find(([, style]) => style.emoji === category)
  return match?.[0] ?? initialFormState.category
}

function formatStatus(status: MerchantOfferStatus) {
  return statusMeta[status]
}

function toLocalDateInput(dateIso: string | null): string {
  if (!dateIso) return ''

  // Keep date-only values stable across timezones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return dateIso
  }

  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function MerchantOffers({ merchantId, className = '' }: MerchantOffersProps) {
  const { offers: fetchedOffers, loading, error } = useMerchantOffers(merchantId)
  const [offers, setOffers] = useState<MerchantOffer[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null)
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null)
  const [offerToDelete, setOfferToDelete] = useState<MerchantOffer | null>(null)
  const [duplicatingOfferId, setDuplicatingOfferId] = useState<string | null>(null)
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
        .from('network_members')
        .select('network_id, networks:network_id(name)')
        .eq('fournisseur_id', merchantId)
        .eq('status', 'active')

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
          name: (typeof name === 'string' ? name.trim() : '') || 'Reseau Looyaal',
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
    setEditingOfferId(null)
    setSubmitError(null)
    setModalOpen(true)
  }

  const openEditModal = (offer: MerchantOffer) => {
    setForm({
      name: offer.name,
      description: offer.description ?? '',
      points_required: offer.points_required,
      expiry_date: toLocalDateInput(offer.expiry_date),
      reward_delivery_type: offer.reward_delivery_type,
      category: categoryValue(offer.category),
      network_ids: [...offer.network_ids],
    })
    setEditingOfferId(offer.id)
    setSubmitError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (saving) return
    setModalOpen(false)
    setEditingOfferId(null)
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
  const isEditing = editingOfferId !== null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit || !merchantId) {
      return
    }

    setSaving(true)
    setSubmitError(null)

    const tempId = editingOfferId ?? `temp-${Date.now()}`
    const optimisticOffer: MerchantOffer = {
      id: tempId,
      merchant_id: merchantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      points_required: Number(form.points_required),
      expiry_date: form.expiry_date || null,
      category: form.category,
      reward_delivery_type: form.reward_delivery_type,
      status: 'active',
      redemptions_this_month: 0,
      network_ids: [...form.network_ids],
      created_at: new Date().toISOString(),
    }

    const previousOffers = offers
    setOffers((prev) => {
      if (editingOfferId) {
        return prev.map((offer) => (offer.id === editingOfferId ? { ...offer, ...optimisticOffer } : offer))
      }

      return [optimisticOffer, ...prev]
    })

    const payload = {
      nom: optimisticOffer.name,
      description: optimisticOffer.description ?? 'Offre recompense',
      points_required: optimisticOffer.points_required,
      emoji: categoryMeta(optimisticOffer.category).emoji,
      expiry_date: optimisticOffer.expiry_date || null,
      reward_delivery_type: optimisticOffer.reward_delivery_type,
      actif: true,
    }

    const query = editingOfferId
      ? supabase
          .from('reward_rules')
          .update(payload)
          .eq('id', editingOfferId)
          .select('*')
          .single()
      : supabase
          .from('reward_rules')
          .insert({
            fournisseur_id: merchantId,
            ...payload,
          })
          .select('*')
          .single()

    const { data, error: submitQueryError } = await query

    if (submitQueryError || !data) {
      setOffers(previousOffers)
      setSaving(false)
      setSubmitError(submitQueryError?.message || `Impossible de ${editingOfferId ? 'modifier' : 'creer'} cette offre pour le moment.`)
      return
    }

    const inserted = data as {
      id: string
      fournisseur_id: string
      nom: string
      description: string | null
      points_required: number | null
      emoji: string | null
      expiry_date: string | null
      reward_delivery_type: 'in_store' | 'digital_code' | null
      actif: boolean | null
      created_at: string
    }

    const finalOffer: MerchantOffer = {
      id: inserted.id,
      merchant_id: inserted.fournisseur_id,
      name: inserted.nom,
      description: inserted.description,
      points_required: Number(inserted.points_required ?? 0),
      expiry_date: inserted.expiry_date,
      category: inserted.emoji,
      reward_delivery_type: inserted.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store',
      status: inserted.actif === false ? 'paused' : 'active',
      redemptions_this_month: 0,
      network_ids: [],
      created_at: inserted.created_at,
    }

    setOffers((prev) => {
      if (editingOfferId) {
        return prev.map((offer) => (offer.id === editingOfferId ? finalOffer : offer))
      }

      return [finalOffer, ...prev.filter((offer) => offer.id !== tempId)]
    })
    setSaving(false)
    setModalOpen(false)
    setEditingOfferId(null)
    setForm(initialFormState)
  }

  const handleToggleStatus = async (offer: MerchantOffer) => {
    const nextStatus: MerchantOfferStatus = offer.status === 'active' ? 'paused' : 'active'
    const previousOffers = offers
    setSubmitError(null)
    setOffers((prev) => prev.map((item) => (item.id === offer.id ? { ...item, status: nextStatus } : item)))

    const { data, error: updateError } = await supabase
      .from('reward_rules')
      .update({ actif: nextStatus === 'active' })
      .eq('id', offer.id)
      .select('*')
      .single()

    if (updateError || !data) {
      setOffers(previousOffers)
      setSubmitError(updateError?.message || 'Impossible de mettre à jour le statut de cette offre.')
      return
    }

    const updated = data as {
      id: string
      fournisseur_id: string
      nom: string
      description: string | null
      points_required: number | null
      emoji: string | null
      expiry_date: string | null
      reward_delivery_type: 'in_store' | 'digital_code' | null
      actif: boolean | null
      created_at: string
    }

    setOffers((prev) => prev.map((item) => (
      item.id === offer.id
        ? {
            ...item,
            name: updated.nom,
            description: updated.description,
            points_required: Number(updated.points_required ?? 0),
            expiry_date: updated.expiry_date,
            category: updated.emoji,
            reward_delivery_type: updated.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store',
            status: updated.actif === false ? 'paused' : 'active',
          }
        : item
    )))
  }

  const handleDelete = async (offer: MerchantOffer) => {
    const previousOffers = offers
    setDeletingOfferId(offer.id)
    setSubmitError(null)
    setOffers((prev) => prev.filter((item) => item.id !== offer.id))

    const { error: deleteError } = await supabase
      .from('reward_rules')
      .delete()
      .eq('id', offer.id)

    if (deleteError) {
      setOffers(previousOffers)
      setSubmitError(deleteError.message || 'Impossible de supprimer cette offre.')
    }

    setDeletingOfferId(null)
    setOfferToDelete(null)
  }

  const handleDuplicate = async (offer: MerchantOffer) => {
    if (!merchantId) {
      return
    }

    const tempId = `temp-duplicate-${Date.now()}`
    const previousOffers = offers
    const duplicatedName = `${offer.name} (copie)`
    setDuplicatingOfferId(offer.id)
    setSubmitError(null)

    const optimisticOffer: MerchantOffer = {
      ...offer,
      id: tempId,
      name: duplicatedName,
      created_at: new Date().toISOString(),
    }

    setOffers((prev) => [optimisticOffer, ...prev])

    const { data, error: duplicateError } = await supabase
      .from('reward_rules')
      .insert({
        fournisseur_id: merchantId,
        nom: duplicatedName,
        description: offer.description ?? 'Offre recompense',
        points_required: offer.points_required,
        emoji: categoryMeta(offer.category).emoji,
        expiry_date: offer.expiry_date || null,
        reward_delivery_type: offer.reward_delivery_type,
        actif: offer.status === 'active',
      })
      .select('*')
      .single()

    if (duplicateError || !data) {
      setOffers(previousOffers)
      setSubmitError(duplicateError?.message || 'Impossible de dupliquer cette offre.')
      setDuplicatingOfferId(null)
      return
    }

    const inserted = data as {
      id: string
      fournisseur_id: string
      nom: string
      description: string | null
      points_required: number | null
      emoji: string | null
      expiry_date: string | null
      reward_delivery_type: 'in_store' | 'digital_code' | null
      actif: boolean | null
      created_at: string
    }

    const finalOffer: MerchantOffer = {
      id: inserted.id,
      merchant_id: inserted.fournisseur_id,
      name: inserted.nom,
      description: inserted.description,
      points_required: Number(inserted.points_required ?? 0),
      expiry_date: inserted.expiry_date,
      category: inserted.emoji,
      reward_delivery_type: inserted.reward_delivery_type === 'digital_code' ? 'digital_code' : 'in_store',
      status: inserted.actif === false ? 'paused' : 'active',
      redemptions_this_month: 0,
      network_ids: [],
      created_at: inserted.created_at,
    }

    setOffers((prev) => [finalOffer, ...prev.filter((item) => item.id !== tempId)])
    setDuplicatingOfferId(null)
  }

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Offres recompenses</p>
        <Button variant="soft" size="sm" className="hover:bg-[#FFF4EE] hover:border-[#FF6B35]/35 hover:text-[#C84E20]" onClick={openModal}>
          + Nouvelle offre
        </Button>
      </header>

      {modalOpen ? (
        <div className="mb-4 min-h-[260px] rounded-lg border border-violet-200 bg-violet-50/45 p-4">
          <h3 className="font-display text-lg font-bold text-dark">{isEditing ? 'Modifier une offre' : 'Creer une offre'}</h3>
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

            <fieldset className="md:col-span-2">
              <legend className="mb-1 block font-body text-xs text-gray-600">Mode d'utilisation</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={`rounded-md border px-3 py-3 transition ${form.reward_delivery_type === 'in_store' ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white'}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="reward_delivery_type"
                      value="in_store"
                      checked={form.reward_delivery_type === 'in_store'}
                      onChange={() => setForm((prev) => ({ ...prev, reward_delivery_type: 'in_store' }))}
                      className="mt-0.5 h-4 w-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="font-body text-sm font-semibold text-dark">En boutique (présence physique)</p>
                      <p className="mt-1 font-body text-xs text-gray-500">Utilisation déclenchée par le marchand en caisse.</p>
                    </div>
                  </div>
                </label>

                <label className="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 opacity-70">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="reward_delivery_type"
                      value="digital_code"
                      checked={form.reward_delivery_type === 'digital_code'}
                      disabled
                      readOnly
                      className="mt-0.5 h-4 w-4 border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-body text-sm font-semibold text-gray-600">Code digital (e-commerce)</p>
                        <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 font-body text-[11px] font-semibold text-gray-500">Bientôt disponible</span>
                      </div>
                      <p className="mt-1 font-body text-xs text-gray-500">Réservé au futur parcours e-commerce.</p>
                    </div>
                  </div>
                </label>
              </div>
            </fieldset>

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
                {isEditing ? 'Enregistrer' : 'Creer'}
              </Button>
              <Button type="button" variant="soft" size="sm" onClick={closeModal}>
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
                <p className="mt-1 inline-flex items-center gap-1.5 font-body text-xs text-gray-500">
                  {offer.reward_delivery_type === 'digital_code' ? (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      Code digital
                    </>
                  ) : (
                    <>
                      <MapPin className="h-3.5 w-3.5" />
                      En boutique
                    </>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" variant="soft" size="sm" onClick={() => openEditModal(offer)}>
                  Editer
                </Button>
                <Button type="button" variant="soft" size="sm" loading={duplicatingOfferId === offer.id} onClick={() => { void handleDuplicate(offer) }}>
                  Dupliquer
                </Button>
                <Button type="button" variant="soft" size="sm" onClick={() => { void handleToggleStatus(offer) }}>
                  {offer.status === 'active' ? 'Pause' : 'Activer'}
                </Button>
                <Button type="button" variant="soft" size="sm" loading={deletingOfferId === offer.id} onClick={() => setOfferToDelete(offer)}>
                  Supprimer
                </Button>
              </div>

              <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badgeClass}`}>{status.label}</span>
            </article>
          )
        })}

        {!loading && offers.length === 0 ? <p className="pt-2 font-body text-sm text-gray-500">Aucune offre pour le moment.</p> : null}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}

      <ConfirmModal
        open={offerToDelete !== null}
        title="Supprimer cette offre"
        description={offerToDelete ? `L'offre "${offerToDelete.name}" sera supprimée définitivement.` : ''}
        onClose={() => {
          if (!deletingOfferId) {
            setOfferToDelete(null)
          }
        }}
        onConfirm={() => {
          if (offerToDelete) {
            void handleDelete(offerToDelete)
          }
        }}
        confirmLabel="Supprimer"
        loading={Boolean(deletingOfferId)}
        destructive
        theme="light"
      />
    </section>
  )
}
