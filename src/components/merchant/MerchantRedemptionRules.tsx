import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../components/ui'
import { supabase } from '../../shared/lib/supabaseClient'

export interface MerchantRedemptionRulesProps {
  merchantId: string
  className?: string
}

type DiscountType = 'fixed' | 'percent'

type RedemptionRule = {
  id: string
  fournisseur_id: string
  label: string
  points_cost: number
  discount_value: number
  discount_type: DiscountType
  max_discount_eur: number | null
  actif: boolean
  created_at: string
}

type RuleFormState = {
  label: string
  points_cost: string
  discount_type: DiscountType
  discount_value: string
  max_discount_eur: string
  actif: boolean
}

const initialFormState: RuleFormState = {
  label: '',
  points_cost: '100',
  discount_type: 'fixed',
  discount_value: '1',
  max_discount_eur: '',
  actif: true,
}

function toNumber(value: string): number {
  const normalized = value.replace(',', '.').trim()
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function mapRuleRow(row: {
  id: string
  fournisseur_id: string
  label: string
  points_cost: number | string
  discount_value: number | string
  discount_type: DiscountType
  max_discount_eur: number | string | null
  actif: boolean | null
  created_at: string
}): RedemptionRule {
  return {
    id: row.id,
    fournisseur_id: row.fournisseur_id,
    label: row.label,
    points_cost: Number(row.points_cost),
    discount_value: Number(row.discount_value),
    discount_type: row.discount_type,
    max_discount_eur: row.max_discount_eur == null ? null : Number(row.max_discount_eur),
    actif: Boolean(row.actif ?? true),
    created_at: row.created_at,
  }
}

export function MerchantRedemptionRules({ merchantId, className = '' }: MerchantRedemptionRulesProps) {
  const [rules, setRules] = useState<RedemptionRule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [conversionRateInput, setConversionRateInput] = useState('100')
  const [savingConversionRate, setSavingConversionRate] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleFormState>(initialFormState)
  const [savingRule, setSavingRule] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const loadAll = async () => {
    if (!merchantId) {
      setRules([])
      setConversionRateInput('100')
      return
    }

    setLoading(true)
    setError(null)

    const [providerResult, rulesResult] = await Promise.all([
      supabase
        .from('fournisseurs')
        .select('points_conversion_rate')
        .eq('id', merchantId)
        .maybeSingle<{ points_conversion_rate: number | string | null }>(),
      supabase
        .from('redemption_rules')
        .select('*')
        .eq('fournisseur_id', merchantId)
        .order('created_at', { ascending: false }),
    ])

    if (providerResult.error) {
      setLoading(false)
      setError(providerResult.error.message)
      return
    }

    if (rulesResult.error) {
      setLoading(false)
      setError(rulesResult.error.message)
      return
    }

    const conversion = Number(providerResult.data?.points_conversion_rate ?? 100)
    setConversionRateInput(Number.isFinite(conversion) && conversion > 0 ? String(conversion) : '100')

    const mapped = ((rulesResult.data ?? []) as Array<{
      id: string
      fournisseur_id: string
      label: string
      points_cost: number | string
      discount_value: number | string
      discount_type: DiscountType
      max_discount_eur: number | string | null
      actif: boolean | null
      created_at: string
    }>).map(mapRuleRow)

    setRules(mapped)
    setLoading(false)
  }

  useEffect(() => {
    void loadAll()
  }, [merchantId])

  const conversionRate = useMemo(() => {
    const parsed = toNumber(conversionRateInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 100
    }

    return parsed
  }, [conversionRateInput])

  const conversionPreview = useMemo(() => {
    return {
      for100: Number((100 / conversionRate).toFixed(2)),
      for250: Number((250 / conversionRate).toFixed(2)),
    }
  }, [conversionRate])

  const isEditing = editingRuleId !== null

  const filteredRules = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return rules.filter((rule) => {
      if (statusFilter === 'active' && !rule.actif) {
        return false
      }

      if (statusFilter === 'inactive' && rule.actif) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      return rule.label.toLowerCase().includes(normalizedQuery)
    })
  }, [rules, searchQuery, statusFilter])

  const resetForm = () => {
    setForm(initialFormState)
    setEditingRuleId(null)
    setFormOpen(false)
    setSubmitError(null)
  }

  const openCreateForm = () => {
    setForm(initialFormState)
    setEditingRuleId(null)
    setSubmitError(null)
    setFormOpen(true)
  }

  const openEditForm = (rule: RedemptionRule) => {
    setForm({
      label: rule.label,
      points_cost: String(rule.points_cost),
      discount_type: rule.discount_type,
      discount_value: String(rule.discount_value),
      max_discount_eur: rule.max_discount_eur == null ? '' : String(rule.max_discount_eur),
      actif: rule.actif,
    })
    setEditingRuleId(rule.id)
    setSubmitError(null)
    setFormOpen(true)
  }

  const validateForm = (): string | null => {
    if (!form.label.trim()) {
      return 'Le libelle de la regle est requis.'
    }

    const pointsCost = Math.trunc(toNumber(form.points_cost))
    if (!Number.isFinite(pointsCost) || pointsCost <= 0) {
      return 'Le cout en points doit etre superieur a 0.'
    }

    const discountValue = toNumber(form.discount_value)
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return 'La valeur de remise doit etre superieure a 0.'
    }

    if (form.discount_type === 'percent' && discountValue > 100) {
      return 'Le pourcentage de remise ne peut pas depasser 100%.'
    }

    if (form.discount_type === 'percent' && form.max_discount_eur.trim()) {
      const cap = toNumber(form.max_discount_eur)
      if (!Number.isFinite(cap) || cap <= 0) {
        return 'Le plafond max doit etre superieur a 0 EUR.'
      }
    }

    return null
  }

  const handleSaveConversionRate = async () => {
    if (!merchantId || savingConversionRate) {
      return
    }

    const parsed = toNumber(conversionRateInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Le taux de conversion doit etre superieur a 0.')
      return
    }

    setSavingConversionRate(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('fournisseurs')
      .update({ points_conversion_rate: parsed })
      .eq('id', merchantId)

    if (updateError) {
      setError(updateError.message)
    }

    setSavingConversionRate(false)
  }

  const handleSubmitRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!merchantId || savingRule) {
      return
    }

    const formError = validateForm()
    if (formError) {
      setSubmitError(formError)
      return
    }

    const pointsCost = Math.trunc(toNumber(form.points_cost))
    const discountValue = toNumber(form.discount_value)
    const maxDiscount = form.discount_type === 'percent' && form.max_discount_eur.trim()
      ? toNumber(form.max_discount_eur)
      : null

    setSavingRule(true)
    setSubmitError(null)

    const payload = {
      label: form.label.trim(),
      points_cost: pointsCost,
      discount_type: form.discount_type,
      discount_value: discountValue,
      max_discount_eur: maxDiscount,
      actif: form.actif,
    }

    const query = editingRuleId
      ? supabase
          .from('redemption_rules')
          .update(payload)
          .eq('id', editingRuleId)
          .eq('fournisseur_id', merchantId)
          .select('*')
          .single()
      : supabase
          .from('redemption_rules')
          .insert({
            fournisseur_id: merchantId,
            ...payload,
          })
          .select('*')
          .single()

    const { data, error: saveError } = await query

    if (saveError || !data) {
      setSubmitError(saveError?.message || 'Impossible de sauvegarder la regle.')
      setSavingRule(false)
      return
    }

    const mapped = mapRuleRow(data as {
      id: string
      fournisseur_id: string
      label: string
      points_cost: number | string
      discount_value: number | string
      discount_type: DiscountType
      max_discount_eur: number | string | null
      actif: boolean | null
      created_at: string
    })

    setRules((prev) => {
      if (editingRuleId) {
        return prev.map((item) => (item.id === editingRuleId ? mapped : item))
      }

      return [mapped, ...prev]
    })

    setSavingRule(false)
    resetForm()
  }

  const handleToggleRuleStatus = async (rule: RedemptionRule) => {
    const { data, error: toggleError } = await supabase
      .from('redemption_rules')
      .update({ actif: !rule.actif })
      .eq('id', rule.id)
      .eq('fournisseur_id', merchantId)
      .select('*')
      .single()

    if (toggleError || !data) {
      setError(toggleError?.message || 'Impossible de mettre a jour le statut de la regle.')
      return
    }

    const mapped = mapRuleRow(data as {
      id: string
      fournisseur_id: string
      label: string
      points_cost: number | string
      discount_value: number | string
      discount_type: DiscountType
      max_discount_eur: number | string | null
      actif: boolean | null
      created_at: string
    })

    setRules((prev) => prev.map((item) => (item.id === rule.id ? mapped : item)))
  }

  const handleDeleteRule = async (rule: RedemptionRule) => {
    const confirmed = window.confirm(`Supprimer la regle "${rule.label}" ?`)
    if (!confirmed) {
      return
    }

    const previousRules = rules
    setRules((prev) => prev.filter((item) => item.id !== rule.id))

    const { error: deleteError } = await supabase
      .from('redemption_rules')
      .delete()
      .eq('id', rule.id)
      .eq('fournisseur_id', merchantId)

    if (deleteError) {
      setRules(previousRules)
      setError(deleteError.message || 'Impossible de supprimer la regle.')
    }
  }

  return (
    <section id="redemption-rules" className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.16em] text-gray-500">Redemption rules</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-dark">Regles de reduction par points</h2>
          <p className="mt-1 font-body text-sm text-gray-600">
            Creez les regles de remise utilisees dans la caisse fournisseur.
          </p>
        </div>
        <Button variant="soft" size="sm" onClick={openCreateForm}>
          + Nouvelle regle
        </Button>
      </header>

      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block font-body text-xs text-gray-600">Taux de conversion fournisseur (points pour 1 EUR)</span>
            <input
              type="number"
              min={1}
              step="1"
              value={conversionRateInput}
              onChange={(event) => setConversionRateInput(event.target.value.replace(/[^0-9.,]/g, ''))}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
              placeholder="Ex: 100"
            />
          </label>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void handleSaveConversionRate()
            }}
            disabled={savingConversionRate}
          >
            {savingConversionRate ? 'Enregistrement...' : 'Enregistrer le taux'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Apercu: 100 pts = {formatMoney(conversionPreview.for100)} EUR | 250 pts = {formatMoney(conversionPreview.for250)} EUR
        </p>
      </div>

      {formOpen ? (
        <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/45 p-4">
          <h3 className="font-display text-lg font-bold text-dark">{isEditing ? 'Modifier une regle' : 'Creer une regle'}</h3>
          <form className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={handleSubmitRule}>
            <label className="block md:col-span-2">
              <span className="mb-1 block font-body text-xs text-gray-600">Libelle</span>
              <input
                type="text"
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                placeholder="Ex: Remise cafe"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Cout en points</span>
              <input
                type="number"
                min={1}
                step="1"
                value={form.points_cost}
                onChange={(event) => setForm((prev) => ({ ...prev, points_cost: event.target.value.replace(/[^0-9]/g, '') }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Type de remise</span>
              <select
                value={form.discount_type}
                onChange={(event) => setForm((prev) => ({ ...prev, discount_type: event.target.value as DiscountType }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
              >
                <option value="fixed">Montant fixe (EUR)</option>
                <option value="percent">Pourcentage (%)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">
                {form.discount_type === 'fixed' ? 'Montant de remise (EUR)' : 'Pourcentage de remise (%)'}
              </span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={form.discount_value}
                onChange={(event) => setForm((prev) => ({ ...prev, discount_value: event.target.value.replace(/[^0-9.,]/g, '') }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-body text-xs text-gray-600">Plafond max (EUR, optionnel)</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                disabled={form.discount_type !== 'percent'}
                value={form.max_discount_eur}
                onChange={(event) => setForm((prev) => ({ ...prev, max_discount_eur: event.target.value.replace(/[^0-9.,]/g, '') }))}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400 disabled:cursor-not-allowed disabled:bg-gray-100"
                placeholder={form.discount_type === 'percent' ? 'Ex: 5' : 'Uniquement pour %'}
              />
            </label>

            <label className="inline-flex items-center gap-2 md:col-span-2">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={(event) => setForm((prev) => ({ ...prev, actif: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="font-body text-sm text-gray-700">Regle active</span>
            </label>

            {submitError ? (
              <p className="md:col-span-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError}
              </p>
            ) : null}

            <div className="md:col-span-2 flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={savingRule}>
                {savingRule ? 'Enregistrement...' : isEditing ? 'Mettre a jour la regle' : 'Creer la regle'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={savingRule}>
                Annuler
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent" />
        </div>
      ) : null}

      {!loading && rules.length > 0 ? (
        <div className="mb-4 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-body text-xs text-gray-600">Rechercher une regle</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ex: remise cafe"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-xs text-gray-600">Statut</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-body text-sm text-dark outline-none transition focus:border-violet-400"
            >
              <option value="all">Toutes les regles</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </select>
          </label>
        </div>
      ) : null}

      {!loading && rules.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
          Aucune regle de redemption pour le moment. Creez votre premiere regle pour guider les remises en caisse.
        </p>
      ) : null}

      {!loading && rules.length > 0 && filteredRules.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-sm text-gray-600">
          Aucune regle ne correspond au filtre actuel.
        </p>
      ) : null}

      {!loading && filteredRules.length > 0 ? (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <article key={rule.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">
                    {rule.actif ? 'Active' : 'Inactive'}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-bold text-dark">{rule.label}</h3>
                  <p className="mt-1 font-body text-sm text-gray-600">
                    {rule.points_cost.toLocaleString('fr-FR')} pts pour {' '}
                    {rule.discount_type === 'fixed'
                      ? `${formatMoney(rule.discount_value)} EUR`
                      : `${formatMoney(rule.discount_value)}%${rule.max_discount_eur != null ? ` (max ${formatMoney(rule.max_discount_eur)} EUR)` : ''}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditForm(rule)}>
                    Modifier
                  </Button>
                  <Button type="button" variant="soft" size="sm" onClick={() => {
                    void handleToggleRuleStatus(rule)
                  }}>
                    {rule.actif ? 'Desactiver' : 'Activer'}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => {
                    void handleDeleteRule(rule)
                  }}>
                    Supprimer
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  )
}
