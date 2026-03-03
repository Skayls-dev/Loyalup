import { useMemo, useState } from 'react'
import { createAnnouncement, deleteAnnouncement, updateAnnouncement } from '../../services/networkService'
import type { NetworkAnnouncement } from '../../types/networkTypes'
import { useNetworks } from '../../hooks/useNetworks'

type AnnouncementManagerProps = {
  announcements: NetworkAnnouncement[]
  onChanged?: () => void
}

const primaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-60'

const secondaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-white px-3 text-xs font-semibold text-[#0078D4] transition hover:bg-[#f3f2f1] disabled:opacity-60'

const dangerButtonClass =
  'h-8 rounded border border-[#d13438] bg-white px-3 text-xs font-semibold text-[#d13438] transition hover:bg-[#fdf3f4]'

const inputClass =
  'rounded border border-[#d2d0ce] bg-white px-2 py-2 text-xs text-[#323130] outline-none focus:border-[#0078D4]'

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
    <section className="space-y-3 rounded-md border border-[#edebe9] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-semibold text-[#323130]">Gestion des annonces</h2>
        <button type="button" onClick={resetForm} className={secondaryButtonClass}>
          Nouvelle annonce
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={form.network_id}
          onChange={(event) => setForm({ ...form, network_id: event.target.value })}
          className={inputClass}
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
          className={inputClass}
          placeholder="Emoji"
        />

        <input
          value={form.title_fr}
          onChange={(event) => setForm({ ...form, title_fr: event.target.value })}
          className={inputClass}
          placeholder="Titre FR"
        />
        <input
          value={form.title_en}
          onChange={(event) => setForm({ ...form, title_en: event.target.value })}
          className={inputClass}
          placeholder="Titre EN"
        />

        <textarea
          value={form.content_fr}
          onChange={(event) => setForm({ ...form, content_fr: event.target.value })}
          className={inputClass}
          rows={3}
          placeholder="Contenu FR"
        />
        <textarea
          value={form.content_en}
          onChange={(event) => setForm({ ...form, content_en: event.target.value })}
          className={inputClass}
          rows={3}
          placeholder="Contenu EN"
        />

        <input
          value={form.cta_label_fr}
          onChange={(event) => setForm({ ...form, cta_label_fr: event.target.value })}
          className={inputClass}
          placeholder="Libellé CTA"
        />
        <input
          value={form.cta_url}
          onChange={(event) => setForm({ ...form, cta_url: event.target.value })}
          className={inputClass}
          placeholder="URL CTA"
        />

        <input
          type="datetime-local"
          value={form.expires_at}
          onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
          className={inputClass}
        />

        <label className="inline-flex items-center gap-2 rounded border border-[#d2d0ce] bg-white px-2 py-2 text-xs text-[#323130]">
          <input
            type="checkbox"
            checked={form.is_pinned}
            onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })}
          />
          Épingler l’annonce
        </label>
      </div>

      {error ? <p className="text-xs text-[#a4262c]">{error}</p> : null}

      <button
        type="button"
        onClick={() => {
          void handleSubmit()
        }}
        disabled={saving}
        className={primaryButtonClass}
      >
        {editingId ? 'Mettre à jour' : 'Créer annonce'}
      </button>

      <div className="space-y-2">
        {sorted.map((item) => (
          <div key={item.id} className="rounded-md border border-[#edebe9] bg-[#faf9f8] p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-[#323130]">
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
                  className={secondaryButtonClass}
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void deleteAnnouncement(item.id).then(() => onChanged?.())
                  }}
                  className={dangerButtonClass}
                >
                  Supprimer
                </button>
              </div>
            </div>
            <p className="text-[#605E5C]">{item.content.fr ?? item.content.en ?? '-'}</p>
            <p className="mt-1 text-[10px] text-[#605E5C]">
              {new Date(item.published_at).toLocaleString('fr-FR')}
              {item.expires_at ? ` · expire ${new Date(item.expires_at).toLocaleString('fr-FR')}` : ''}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
