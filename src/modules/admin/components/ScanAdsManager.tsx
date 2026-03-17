import { useEffect, useMemo, useState } from 'react'
import { AdBanner, type AdConfig } from '../../providers/components/AdBanner'
import {
  deleteScanAd,
  listScanAds,
  upsertScanAd,
  type ScanAdRow,
} from '../services/adminConsoleService'
import { supabase } from '../../../shared/lib/supabaseClient'

type ScanAdsManagerProps = {
  onStatusChange?: (message: string) => void
}

type AdTemplate = {
  advertiser_name: string
  title: string
  body: string
  cta_label: string
  cta_url: string
  media_type: 'image' | 'video'
  media_url: string
  poster_url?: string
}

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100'
const panelClass = 'rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
const templateCardClass =
  'rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-200 hover:bg-sky-50/60'
const ADS_MEDIA_BUCKET = 'ads-media'

const templates: AdTemplate[] = [
  {
    advertiser_name: 'LoyalUp',
    title: 'Boostez vos visites avec LoyalUp Premium',
    body: 'Activez des campagnes intelligentes et transformez chaque passage en retour client mesurable.',
    cta_label: 'Activer Premium',
    cta_url: 'https://loyalup-pink.vercel.app/provider?tab=developers',
    media_type: 'image',
    media_url: '/ads/premium-boost.svg',
  },
  {
    advertiser_name: 'LoyalUp',
    title: 'Activez vos campagnes flash du week-end',
    body: 'Diffusez une offre limitee, captez les retours rapides et suivez les performances en direct sur votre QR.',
    cta_label: 'Creer une campagne',
    cta_url: 'https://loyalup-pink.vercel.app/provider?tab=promotions',
    media_type: 'image',
    media_url: '/ads/flash-campaign.svg',
  },
  {
    advertiser_name: 'LoyalUp Réseau',
    title: 'Fidelisez mieux avec vos reseaux partenaires',
    body: 'Mettez en avant vos avantages coalition et augmentez les visites croisees entre commerces membres.',
    cta_label: 'Voir les reseaux',
    cta_url: 'https://loyalup-pink.vercel.app/provider/network',
    media_type: 'image',
    media_url: '/ads/coalition-network.svg',
  },
  {
    advertiser_name: 'LoyalUp Demo',
    title: 'Demo video - Parcours client en 15 secondes',
    body: 'Montrez concretement votre experience fidelite avec une video courte directement sur l\'ecran QR.',
    cta_label: 'Voir la demo',
    cta_url: 'https://loyalup-pink.vercel.app/provider?tab=dashboard',
    media_type: 'video',
    media_url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    poster_url: '/ads/premium-boost.svg',
  },
  {
    advertiser_name: 'Épicerie Fraîche',
    title: 'Produits locaux livrés chaque matin',
    body: 'Fruits, légumes, fromages et charcuterie sélectionnés chaque matin chez nos producteurs partenaires. -15% avec 250 pts.',
    cta_label: 'Commander maintenant',
    cta_url: 'https://loyalup-pink.vercel.app/client',
    media_type: 'image',
    media_url: '/ads/epicerie-fraiche.svg',
  },
]

function toAdPreviewConfig(ad: {
  advertiser_name?: string | null
  title: string
  body: string
  cta_label?: string | null
  cta_url?: string | null
  media_type?: 'image' | 'video' | null
  media_url?: string | null
  poster_url?: string | null
}): AdConfig {
  return {
    badge: ad.advertiser_name?.trim() || 'Annonceur',
    title: ad.title,
    description: ad.body,
    ctaLabel: ad.cta_label?.trim() || 'En savoir plus',
    ctaUrl: ad.cta_url?.trim() || undefined,
    ctaNote: 'Diffusion QR · Rotation automatique',
    mediaType: ad.media_type ?? undefined,
    mediaUrl: ad.media_url?.trim() || undefined,
    posterUrl: ad.poster_url?.trim() || undefined,
  }
}

export function ScanAdsManager({ onStatusChange }: ScanAdsManagerProps) {
  const [ads, setAds] = useState<ScanAdRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingAdId, setEditingAdId] = useState<string | null>(null)
  const [advertiserName, setAdvertiserName] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [ctaLabel, setCtaLabel] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [mediaUrl, setMediaUrl] = useState('')
  const [posterUrl, setPosterUrl] = useState('')
  const [displayOrder, setDisplayOrder] = useState(0)
  const [active, setActive] = useState(true)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadingPoster, setUploadingPoster] = useState(false)

  const uploadAsset = async (file: File, folder: 'images' | 'videos' | 'posters') => {
    const sanitized = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
    const path = `scan-ads/${folder}/${Date.now()}-${sanitized}`
    const { error } = await supabase.storage.from(ADS_MEDIA_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    })

    if (error) {
      throw error
    }

    const { data } = supabase.storage.from(ADS_MEDIA_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const loadAds = async () => {
    setLoading(true)
    try {
      const rows = await listScanAds()
      setAds(rows)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de charger les publicites'
      onStatusChange?.(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAds()
  }, [])

  const resetForm = () => {
    setEditingAdId(null)
    setAdvertiserName('')
    setTitle('')
    setBody('')
    setCtaLabel('')
    setCtaUrl('')
    setMediaType('image')
    setMediaUrl('')
    setPosterUrl('')
    setDisplayOrder(0)
    setActive(true)
    setStartsAt('')
    setEndsAt('')
  }

  const previewConfig = useMemo(
    () =>
      toAdPreviewConfig({
        advertiser_name: advertiserName.trim() || null,
        title: title.trim() || 'Votre prochaine campagne QR',
        body: body.trim() || 'Ajoutez ici un message clair et vendeur pour vos commerçants.',
        cta_label: ctaLabel.trim() || 'Decouvrir',
        cta_url: ctaUrl.trim() || null,
        media_type: mediaUrl.trim() ? mediaType : null,
        media_url: mediaUrl.trim() || null,
        poster_url: posterUrl.trim() || null,
      }),
    [advertiserName, body, ctaLabel, ctaUrl, mediaType, mediaUrl, posterUrl, title],
  )

  const handleTemplateApply = (template: AdTemplate, index: number) => {
    setAdvertiserName(template.advertiser_name)
    setTitle(template.title)
    setBody(template.body)
    setCtaLabel(template.cta_label)
    setCtaUrl(template.cta_url)
    setMediaType(template.media_type)
    setMediaUrl(template.media_url)
    setPosterUrl(template.poster_url ?? '')
    setDisplayOrder(index + 1)
    setActive(true)
  }

  const handleActivateVideoTemplate = async () => {
    const videoTemplate = templates.find((template) => template.media_type === 'video')
    if (!videoTemplate) {
      onStatusChange?.('Aucun template video disponible')
      return
    }

    setSaving(true)
    try {
      await upsertScanAd({
        advertiser_name: videoTemplate.advertiser_name,
        title: videoTemplate.title,
        body: videoTemplate.body,
        cta_label: videoTemplate.cta_label,
        cta_url: videoTemplate.cta_url,
        media_type: videoTemplate.media_type,
        media_url: videoTemplate.media_url,
        poster_url: videoTemplate.poster_url ?? null,
        active: true,
        display_order: 1,
      })

      onStatusChange?.('Template video active sur la rotation QR')
      await loadAds()
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Impossible d\'activer le template video')
    } finally {
      setSaving(false)
    }
  }

  const handleSeedTemplates = async () => {
    setSaving(true)
    try {
      for (let index = 0; index < templates.length; index += 1) {
        const template = templates[index]
        await upsertScanAd({
          advertiser_name: template.advertiser_name,
          title: template.title,
          body: template.body,
          cta_label: template.cta_label,
          cta_url: template.cta_url,
          media_type: template.media_type,
          media_url: template.media_url,
          poster_url: template.poster_url ?? null,
          active: true,
          display_order: index + 1,
        })
      }
      onStatusChange?.(`${templates.length} publicites test ont ete ajoutees`)
      await loadAds()
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Impossible de creer les publicites test')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await upsertScanAd({
        id: editingAdId ?? undefined,
        advertiser_name: advertiserName.trim() || null,
        title,
        body,
        cta_label: ctaLabel || null,
        cta_url: ctaUrl || null,
        media_type: mediaUrl.trim() ? mediaType : null,
        media_url: mediaUrl.trim() || null,
        poster_url: posterUrl.trim() || null,
        active,
        display_order: displayOrder,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      })
      onStatusChange?.(editingAdId ? 'Publicite mise a jour' : 'Publicite creee')
      resetForm()
      await loadAds()
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Impossible d\'enregistrer la publicite')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (ad: ScanAdRow) => {
    setEditingAdId(ad.id)
    setAdvertiserName(ad.advertiser_name ?? '')
    setTitle(ad.title)
    setBody(ad.body)
    setCtaLabel(ad.cta_label ?? '')
    setCtaUrl(ad.cta_url ?? '')
    setMediaType(ad.media_type ?? 'image')
    setMediaUrl(ad.media_url ?? '')
    setPosterUrl(ad.poster_url ?? '')
    setDisplayOrder(ad.display_order)
    setActive(ad.active)
    setStartsAt(ad.starts_at ? ad.starts_at.slice(0, 16) : '')
    setEndsAt(ad.ends_at ? ad.ends_at.slice(0, 16) : '')
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteScanAd(id)
      if (editingAdId === id) {
        resetForm()
      }
      onStatusChange?.('Publicite supprimee')
      await loadAds()
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Suppression impossible')
    }
  }

  const handleToggle = async (ad: ScanAdRow) => {
    try {
      await upsertScanAd({
        id: ad.id,
        advertiser_name: ad.advertiser_name,
        title: ad.title,
        body: ad.body,
        cta_label: ad.cta_label,
        cta_url: ad.cta_url,
        media_type: ad.media_type,
        media_url: ad.media_url,
        poster_url: ad.poster_url,
        active: !ad.active,
        display_order: ad.display_order,
        starts_at: ad.starts_at,
        ends_at: ad.ends_at,
      })
      onStatusChange?.(ad.active ? 'Publicite desactivee' : 'Publicite activee')
      await loadAds()
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Impossible de changer le statut')
    }
  }

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploadingMedia(true)
    try {
      const url = await uploadAsset(file, mediaType === 'video' ? 'videos' : 'images')
      setMediaUrl(url)
      onStatusChange?.('Visuel uploadé vers Supabase Storage')
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Upload media impossible')
    } finally {
      setUploadingMedia(false)
      event.target.value = ''
    }
  }

  const handlePosterUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setUploadingPoster(true)
    try {
      const url = await uploadAsset(file, 'posters')
      setPosterUrl(url)
      onStatusChange?.('Poster uploadé vers Supabase Storage')
    } catch (error) {
      onStatusChange?.(error instanceof Error ? error.message : 'Upload poster impossible')
    } finally {
      setUploadingPoster(false)
      event.target.value = ''
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/45">Regie QR</p>
            <h3 className="mt-2 text-3xl font-semibold">Pilotez les publicites affichees sur l'ecran QR provider</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              Creez vos messages, ajoutez un visuel image ou video, previsualisez leur rendu et alimentez la rotation avec quelques campagnes test en un clic.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void handleSeedTemplates() }}
              disabled={saving}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
            >
              Ajouter {templates.length} pubs test
            </button>
            <button
              type="button"
              onClick={() => { void handleActivateVideoTemplate() }}
              disabled={saving}
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/30 disabled:opacity-60"
            >
              Activer template video
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Nouvelle pub
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className={`${panelClass} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Edition</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-900">
                {editingAdId ? 'Modifier la campagne' : 'Nouvelle campagne QR'}
              </h4>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {templates.map((template, index) => (
              <button
                key={template.title}
                type="button"
                onClick={() => handleTemplateApply(template, index)}
                className={templateCardClass}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">{template.advertiser_name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{template.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 line-clamp-2">{template.body}</p>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-700">
                  {template.media_type === 'video' ? '▶ Template video' : '🖼 Template image'}
                </p>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Pour activer un template: cliquez une carte ci-dessus, puis cliquez sur Publier.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <input value={advertiserName} onChange={(event) => setAdvertiserName(event.target.value)} placeholder="Nom de l'annonceur (ex: Épicerie Fraîche, LoyalUp…)" className="md:col-span-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100" />
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Titre" className={inputClass} />
            <input value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} placeholder="CTA" className={inputClass} />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Message de la publicite"
              className="min-h-[120px] rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 md:col-span-2"
            />
            <input value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} placeholder="URL CTA (https://...)" className={inputClass} />
            <select value={mediaType} onChange={(event) => setMediaType(event.target.value as 'image' | 'video')} className={inputClass}>
              <option value="image">Visuel image</option>
              <option value="video">Visuel video</option>
            </select>
            <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={mediaType === 'video' ? 'URL video (/ads/demo.mp4 ou https://...)' : 'URL image (/ads/visuel.svg ou https://...)'} className="md:col-span-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100" />
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100">
                {uploadingMedia ? 'Upload...' : mediaType === 'video' ? 'Uploader la video' : 'Uploader l\'image'}
                <input type="file" accept={mediaType === 'video' ? 'video/mp4,video/webm' : 'image/*'} onChange={(event) => { void handleMediaUpload(event) }} className="hidden" disabled={uploadingMedia} />
              </label>
              <span>Le fichier est stocké dans Supabase Storage puis son URL publique est injectée.</span>
            </div>
            {mediaType === 'video' ? (
              <>
                <input value={posterUrl} onChange={(event) => setPosterUrl(event.target.value)} placeholder="Poster video optionnel (/ads/poster.jpg ou https://...)" className="md:col-span-2 h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100" />
                <div className="md:col-span-2 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-100">
                    {uploadingPoster ? 'Upload...' : 'Uploader le poster'}
                    <input type="file" accept="image/*" onChange={(event) => { void handlePosterUpload(event) }} className="hidden" disabled={uploadingPoster} />
                  </label>
                  <span>Optionnel: utile pour l\'aperçu avant lecture de la vidéo.</span>
                </div>
              </>
            ) : null}
            <input type="number" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} placeholder="Ordre" className={inputClass} />
            <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputClass} />
            <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className={inputClass} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
            Utilisez une URL absolue ou un chemin public commençant par /. Pour une video, renseignez une video lisible par le navigateur et, si besoin, une image de poster.
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Campagne active
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void handleSave() }}
              disabled={saving || !title.trim() || !body.trim()}
              className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-600 disabled:opacity-60"
            >
              {saving ? 'Enregistrement…' : editingAdId ? 'Mettre a jour' : 'Publier'}
            </button>
            {editingAdId ? (
              <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Annuler
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-4">
          <div className={panelClass}>
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">Preview provider</p>
            <AdBanner ad={previewConfig} />
          </div>

          <div className={panelClass}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Bibliotheque</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">Campagnes en rotation</h4>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{ads.length} publicites</span>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? <div className="h-24 animate-pulse rounded-2xl bg-slate-100" /> : null}
              {!loading && ads.length === 0 ? <p className="text-sm text-slate-500">Aucune publicite pour le moment.</p> : null}
              {ads.map((ad) => (
                <article key={ad.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{ad.title}</p>
                        {ad.advertiser_name ? (
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{ad.advertiser_name}</span>
                        ) : null}
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ad.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {ad.active ? 'active' : 'inactive'}
                        </span>
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-700">ordre {ad.display_order}</span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">{ad.body}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                        {ad.cta_label ? <span className="rounded-full bg-white px-2 py-1">CTA: {ad.cta_label}</span> : null}
                        {ad.media_type ? <span className="rounded-full bg-white px-2 py-1">media: {ad.media_type}</span> : null}
                        {ad.media_url ? <span className="rounded-full bg-white px-2 py-1">visuel configure</span> : null}
                        {ad.starts_at ? <span className="rounded-full bg-white px-2 py-1">debut {new Date(ad.starts_at).toLocaleDateString('fr-FR')}</span> : null}
                        {ad.ends_at ? <span className="rounded-full bg-white px-2 py-1">fin {new Date(ad.ends_at).toLocaleDateString('fr-FR')}</span> : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleEdit(ad)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Editer
                      </button>
                      <button type="button" onClick={() => { void handleToggle(ad) }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        {ad.active ? 'Desactiver' : 'Activer'}
                      </button>
                      <button type="button" onClick={() => { void handleDelete(ad.id) }} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">
                        Supprimer
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
