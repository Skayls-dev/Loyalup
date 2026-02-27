import { useMemo, useState } from 'react'
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from '../../services/networkService'
import type { NetworkAnnouncement } from '../../types/networkTypes'
import { useNetworks } from '../../hooks/useNetworks'

type AnnouncementManagerProps = {
  announcements: NetworkAnnouncement[]
  onChanged?: () => void
}

export function AnnouncementManager({ announcements, onChanged }: AnnouncementManagerProps) {
  const { all } = useNetworks()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    network_id: '',
    title_fr: '',
    title_en: '',
    content_fr: '',
    content_en: '',
    emoji: '📢',
    cta_label_fr: '',
    cta_url: '',
    is_pinned: false,
    expires_at: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const sorted = useMemo(
    () => [...announcements].sort((left, right) => new Date(right.published_at).getTime() - new Date(left.published_at).getTime()),
    [announcements],
  )

  const resetForm = () => {
    setEditingId(null)
    setForm({
      network_id: '',
      title_fr: '',
      title_en: '',
      content_fr: '',
      content_en: '',
      emoji: '📢',
      cta_label_fr: '',
      cta_url: '',
      is_pinned: false,
      expires_at: '',
    })
  }

  const handleSubmit = async () => {
    try {
      setSaving(true)
      setError(null)

      if (!form.network_id) {
        throw new Error('Veuillez sélectionner un réseau')
      }

      const payload = {
        network_id: form.network_id,
        title: {
          fr: form.title_fr,
          en: form.title_en || form.title_fr,
          ar: form.title_fr,
          es: form.title_fr,
          nl: form.title_fr,
        },
        content: {
          fr: form.content_fr,
          en: form.content_en || form.content_fr,
          ar: form.content_fr,
          es: form.content_fr,
          nl: form.content_fr,
        },
        emoji: form.emoji,
        cta_label: form.cta_label_fr
          ? {
              fr: form.cta_label_fr,
              en: form.cta_label_fr,
              ar: form.cta_label_fr,
              es: form.cta_label_fr,
              nl: form.cta_label_fr,
            }
          : null,
        cta_url: form.cta_url || null,
        is_pinned: form.is_pinned,
        published_at: new Date().toISOString(),
        expires_at: form.expires_at || null,
      }

      if (editingId) {
        await updateAnnouncement(editingId, payload)
      } else {
        await createAnnouncement(payload)
      }

      resetForm()
      onChanged?.()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Impossible d’enregistrer l’annonce')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Gestion des annonces</h2>
        <button type="button" onClick={resetForm} className="rounded bg-zinc-800 px-2 py-1 text-xs">
          Nouvelle annonce
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={form.network_id}
          onChange={(event) => setForm({ ...form, network_id: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
        >
          <option value="">Sélectionner un réseau</option>
          {all.map((network) => (
            <option key={network.id} value={network.id}>
              {network.emoji} {network.name.fr ?? network.slug}
            </option>
          ))}
        </select>

        <input
          value={form.emoji}
          onChange={(event) => setForm({ ...form, emoji: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          placeholder="Emoji"
        />

        <input
          value={form.title_fr}
          onChange={(event) => setForm({ ...form, title_fr: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          placeholder="Titre FR"
        />
        <input
          value={form.title_en}
          onChange={(event) => setForm({ ...form, title_en: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          placeholder="Titre EN"
        />

        <textarea
          value={form.content_fr}
          onChange={(event) => setForm({ ...form, content_fr: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          rows={3}
          placeholder="Contenu FR"
        />
        <textarea
          value={form.content_en}
          onChange={(event) => setForm({ ...form, content_en: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          rows={3}
          placeholder="Contenu EN"
        />

        <input
          value={form.cta_label_fr}
          onChange={(event) => setForm({ ...form, cta_label_fr: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          placeholder="Libellé CTA"
        />
        <input
          value={form.cta_url}
          onChange={(event) => setForm({ ...form, cta_url: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
          placeholder="URL CTA"
        />

        <input
          type="datetime-local"
          value={form.expires_at}
          onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs"
        />

        <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-xs text-zinc-200">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })}
          />
          Épingler l’annonce
        </label>
      </div>

      {error ? <p className="text-xs text-red-300">{error}</p> : null}

      <button
        type="button"
        onClick={() => {
          void handleSubmit()
        }}
        disabled={saving}
        className="rounded bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-700"
      >
        {editingId ? 'Mettre à jour' : 'Créer annonce'}
      </button>

      <div className="space-y-2">
        {sorted.map((item) => (
          <div key={item.id} className="rounded-lg border border-zinc-800 p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-zinc-100">
                {item.emoji || '📢'} {item.title.fr ?? item.title.en ?? 'Annonce'}
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(item.id)
                    setForm({
                      network_id: item.network_id,
                      title_fr: item.title.fr ?? '',
                      title_en: item.title.en ?? '',
                      content_fr: item.content.fr ?? '',
                      content_en: item.content.en ?? '',
                      emoji: item.emoji ?? '📢',
                      cta_label_fr: item.cta_label?.fr ?? '',
                      cta_url: item.cta_url ?? '',
                      is_pinned: item.is_pinned,
                      expires_at: item.expires_at ? item.expires_at.slice(0, 16) : '',
                    })
                  }}
                  className="rounded bg-zinc-800 px-2 py-1"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteAnnouncement(item.id).then(() => onChanged?.())
                  }}
                  className="rounded bg-red-900/50 px-2 py-1 text-red-200"
                >
                  Supprimer
                </button>
              </div>
            </div>
            <p className="text-zinc-400">{item.content.fr ?? item.content.en ?? '-'}</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              {new Date(item.published_at).toLocaleString('fr-FR')}
              {item.expires_at ? ` · expire ${new Date(item.expires_at).toLocaleString('fr-FR')}` : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
