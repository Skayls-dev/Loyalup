import { Suspense, lazy, useMemo, useState } from 'react'
import { ConfirmModal } from '../../../shared/components/ConfirmModal'
import { PromoTypeBadge } from './PromoTypeBadge'
import { usePromoManager } from '../hooks/usePromoManager'
import type { Promotion } from '../services/promotionService'

const PromoForm = lazy(() => import('./PromoForm').then((module) => ({ default: module.PromoForm })))

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'
const dangerButtonClass =
  'rounded-xl border border-red-800/80 bg-red-950/20 px-2.5 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60'

export function PromoManager() {
  const {
    promotions,
    createPromo,
    updatePromo,
    deletePromo,
    editingPromo,
    setEditingPromo,
    clearEditing,
    loading,
    error,
  } = usePromoManager()
  const [openCreate, setOpenCreate] = useState(false)
  const [promoToDelete, setPromoToDelete] = useState<Promotion | null>(null)

  const now = new Date()
  const activePromotions = useMemo(
    () => promotions.filter((item) => item.actif && new Date(item.date_fin) >= now),
    [promotions, now],
  )
  const pastPromotions = useMemo(
    () => promotions.filter((item) => !item.actif || new Date(item.date_fin) < now),
    [promotions, now],
  )

  const handleDelete = async (promotion: Promotion) => {
    await deletePromo(promotion.id)
    setPromoToDelete(null)
  }

  return (
    <section className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">Mes promotions</h2>
        <button
          type="button"
          onClick={() => setOpenCreate(true)}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900"
        >
          Nouvelle promotion
        </button>
      </div>

      {loading ? <p className="text-sm text-zinc-400">Chargement...</p> : null}
      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}

      <SectionList
        title="Promotions actives"
        items={activePromotions}
        emptyText="Aucune promotion active"
        onEdit={setEditingPromo}
        onDelete={setPromoToDelete}
      />

      <div className="my-4 border-t border-zinc-800" />

      <SectionList
        title="Promotions passées"
        items={pastPromotions}
        emptyText="Aucune promotion passée"
        onEdit={setEditingPromo}
        onDelete={setPromoToDelete}
      />

      {openCreate ? (
        <Suspense fallback={null}>
          <PromoForm
            onSubmit={async (data) => {
              await createPromo(data)
            }}
            onCancel={() => setOpenCreate(false)}
          />
        </Suspense>
      ) : null}

      {editingPromo ? (
        <Suspense fallback={null}>
          <PromoForm
            initialData={editingPromo}
            onSubmit={async (data) => {
              await updatePromo(editingPromo.id, data)
            }}
            onCancel={clearEditing}
          />
        </Suspense>
      ) : null}

      <ConfirmModal
        open={promoToDelete !== null}
        title="Supprimer cette promotion"
        description={promoToDelete ? `La promotion "${promoToDelete.titre}" sera retirée de la liste.` : ''}
        onClose={() => setPromoToDelete(null)}
        onConfirm={() => {
          if (promoToDelete) {
            void handleDelete(promoToDelete)
          }
        }}
        confirmLabel="Supprimer"
        destructive
        theme="dark"
      />
    </section>
  )
}

type SectionListProps = {
  title: string
  items: Promotion[]
  emptyText: string
  onEdit: (promotion: Promotion) => void
  onDelete: (promotion: Promotion) => void
}

function SectionList({ title, items, emptyText, onEdit, onDelete }: SectionListProps) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-zinc-300">{title}</h3>
      {items.length === 0 ? <p className="text-xs text-zinc-500">{emptyText}</p> : null}

      <div className="space-y-2">
        {items.map((promotion) => (
          <article key={promotion.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {promotion.emoji} {promotion.titre}
                </p>
                <p className="text-xs text-zinc-400">
                  {new Date(promotion.date_debut).toLocaleDateString()} → {new Date(promotion.date_fin).toLocaleDateString()}
                </p>
              </div>
              <PromoTypeBadge type={promotion.type} />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onEdit(promotion)}
                className={secondaryButtonClass}
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(promotion)
                }}
                className={dangerButtonClass}
              >
                Supprimer
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
