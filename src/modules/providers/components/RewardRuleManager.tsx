import { useState } from 'react'
import { ConfirmModal } from '../../../shared/components/ConfirmModal'
import type { RewardRuleItem } from '../services/providerService'
import { useRewardRuleManager } from '../hooks/useRewardRuleManager'
import { RewardRuleForm } from './RewardRuleForm'

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

export function RewardRuleManager() {
  const { rules, loading, createItem, updateItem, toggleItem, deleteItem } = useRewardRuleManager()
  const [editing, setEditing] = useState<RewardRuleItem | null>(null)
  const [ruleToDelete, setRuleToDelete] = useState<RewardRuleItem | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleDuplicate = async (rule: RewardRuleItem) => {
    setActionError(null)

    try {
      await createItem({
        nom: `${rule.nom} (copie)`,
        description: rule.description,
        emoji: rule.emoji,
        points_required: rule.points_required,
        reward_delivery_type: rule.reward_delivery_type,
        requires_physical_presence: rule.requires_physical_presence,
      })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de dupliquer cette récompense.')
    }
  }

  const handleDelete = async (rule: RewardRuleItem) => {
    setActionError(null)

    try {
      await deleteItem(rule.id)
      setRuleToDelete(null)

      if (editing?.id === rule.id) {
        setEditing(null)
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de supprimer cette récompense.')
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">Récompenses</h3>
        <button type="button" onClick={() => setOpenCreate(true)} className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900">
          Ajouter une récompense
        </button>
      </div>

      {loading ? <p className="text-xs text-zinc-500">Chargement...</p> : null}
      {actionError ? <p className="text-xs text-rose-400">{actionError}</p> : null}

      <div className="space-y-2">
        {rules.map((rule) => (
          <article key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
            <div>
              <p className="text-sm text-zinc-100">{rule.emoji} {rule.nom}</p>
              <p className="text-xs text-zinc-500">{rule.points_required} pts</p>
              <p className="text-[11px] text-zinc-500">
                {rule.requires_physical_presence ? 'Utilisable uniquement en caisse' : 'Utilisable sans passage en caisse'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActionError(null)
                  toggleItem(rule.id, !rule.actif).catch((error) => {
                    setActionError(error instanceof Error ? error.message : 'Impossible de mettre à jour le statut.')
                  })
                }}
                className={`rounded-md px-2 py-1 text-xs ${rule.actif ? 'bg-emerald-900/60 text-emerald-300' : 'bg-zinc-800 text-zinc-300'}`}
              >
                {rule.actif ? 'Actif' : 'Inactif'}
              </button>
              <button type="button" onClick={() => setEditing(rule)} className={secondaryButtonClass}>Edit</button>
              <button type="button" onClick={() => { void handleDuplicate(rule) }} className={secondaryButtonClass}>Dupliquer</button>
              <button type="button" onClick={() => setRuleToDelete(rule)} className={secondaryButtonClass}>Supprimer</button>
            </div>
          </article>
        ))}

        {!loading && rules.length === 0 ? <p className="text-xs text-zinc-500">Aucune récompense configurée.</p> : null}
      </div>

      {openCreate ? (
        <RewardRuleForm
          onSubmit={async (data) => {
            setActionError(null)
            await createItem(data)
          }}
          onCancel={() => setOpenCreate(false)}
        />
      ) : null}

      {editing ? (
        <RewardRuleForm
          initialData={editing}
          onSubmit={async (data) => {
            setActionError(null)
            await updateItem(editing.id, data)
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <ConfirmModal
        open={ruleToDelete !== null}
        title="Supprimer cette récompense"
        description={ruleToDelete ? `La récompense "${ruleToDelete.nom}" sera supprimée définitivement.` : ''}
        onClose={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (ruleToDelete) {
            void handleDelete(ruleToDelete)
          }
        }}
        confirmLabel="Supprimer"
        destructive
        theme="dark"
      />
    </section>
  )
}
