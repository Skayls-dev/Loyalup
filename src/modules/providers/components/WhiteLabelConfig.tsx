import { useEffect, useMemo, useState } from 'react'
import {
  getWhiteLabelConfig,
  upsertWhiteLabelConfig,
  verifyWhiteLabelDomain,
  type WhiteLabelConfig as WhiteLabelConfigType,
} from '../services/developerPlatformService'

type FormState = {
  brand_name: string
  logo_url: string
  custom_domain: string
  primary_color: string
  secondary_color: string
  accent_color: string
  hide_loyalup_branding: boolean
  custom_terms_url: string
  custom_privacy_url: string
  from_email: string
  from_name: string
  email_header_color: string
}

const initialForm: FormState = {
  brand_name: '',
  logo_url: '',
  custom_domain: '',
  primary_color: '#18181b',
  secondary_color: '#3f3f46',
  accent_color: '#fafafa',
  hide_loyalup_branding: false,
  custom_terms_url: '',
  custom_privacy_url: '',
  from_email: '',
  from_name: '',
  email_header_color: '#18181b',
}

const secondaryButtonClass =
  'rounded-xl border border-zinc-700/80 bg-zinc-900/70 px-2.5 py-1.5 text-xs font-semibold text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60'

export function WhiteLabelConfig() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [status, setStatus] = useState('')
  const [config, setConfig] = useState<WhiteLabelConfigType | null>(null)
  const [form, setForm] = useState<FormState>(initialForm)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setStatus('')
      try {
        const next = await getWhiteLabelConfig()
        setConfig(next)
        if (next) {
          setForm({
            brand_name: next.brand_name,
            logo_url: next.logo_url ?? '',
            custom_domain: next.custom_domain ?? '',
            primary_color: next.primary_color ?? '#18181b',
            secondary_color: next.secondary_color ?? '#3f3f46',
            accent_color: next.accent_color ?? '#fafafa',
            hide_loyalup_branding: next.hide_loyalup_branding,
            custom_terms_url: next.custom_terms_url ?? '',
            custom_privacy_url: next.custom_privacy_url ?? '',
            from_email: next.from_email ?? '',
            from_name: next.from_name ?? '',
            email_header_color: next.email_header_color ?? '#18181b',
          })
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load white-label config')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [])

  const domainInfo = useMemo(() => {
    if (!config?.custom_domain) {
      return null
    }

    return {
      domain: config.custom_domain,
      verified: config.domain_verified,
      token: config.verification_token ?? '',
    }
  }, [config])

  const save = async () => {
    setSaving(true)
    setStatus('')

    try {
      const next = await upsertWhiteLabelConfig({
        brand_name: form.brand_name,
        logo_url: form.logo_url || null,
        favicon_url: null,
        primary_color: form.primary_color || null,
        secondary_color: form.secondary_color || null,
        accent_color: form.accent_color || null,
        font_family: 'DM Sans',
        custom_domain: form.custom_domain || null,
        hide_loyalup_branding: form.hide_loyalup_branding,
        custom_terms_url: form.custom_terms_url || null,
        custom_privacy_url: form.custom_privacy_url || null,
        from_email: form.from_email || null,
        from_name: form.from_name || null,
        email_header_color: form.email_header_color || null,
      })

      setConfig(next)
      setStatus('Configuration enregistrée')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save white-label config')
    } finally {
      setSaving(false)
    }
  }

  const verifyDomain = async () => {
    if (!domainInfo?.domain || !domainInfo.token) {
      return
    }

    setVerifying(true)
    setStatus('')

    try {
      await verifyWhiteLabelDomain(domainInfo.domain, domainInfo.token)
      const refreshed = await getWhiteLabelConfig()
      setConfig(refreshed)
      setStatus('Domaine vérifié')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Domain verification failed')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs text-zinc-500">Chargement...</p>
      </section>
    )
  }

  return (
    <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">White Label</h3>
        <button
          type="button"
          onClick={() => {
            void save()
          }}
          disabled={saving}
          className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nom de marque" value={form.brand_name} onChange={(value) => setForm((prev) => ({ ...prev, brand_name: value }))} />
        <Field label="Logo URL" value={form.logo_url} onChange={(value) => setForm((prev) => ({ ...prev, logo_url: value }))} />
        <Field label="Domaine custom" value={form.custom_domain} onChange={(value) => setForm((prev) => ({ ...prev, custom_domain: value.toLowerCase() }))} />
        <Field label="From email" value={form.from_email} onChange={(value) => setForm((prev) => ({ ...prev, from_email: value }))} />
        <Field label="From name" value={form.from_name} onChange={(value) => setForm((prev) => ({ ...prev, from_name: value }))} />
        <Field label="Terms URL" value={form.custom_terms_url} onChange={(value) => setForm((prev) => ({ ...prev, custom_terms_url: value }))} />
        <Field label="Privacy URL" value={form.custom_privacy_url} onChange={(value) => setForm((prev) => ({ ...prev, custom_privacy_url: value }))} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <ColorField label="Primary" value={form.primary_color} onChange={(value) => setForm((prev) => ({ ...prev, primary_color: value }))} />
        <ColorField label="Secondary" value={form.secondary_color} onChange={(value) => setForm((prev) => ({ ...prev, secondary_color: value }))} />
        <ColorField label="Accent" value={form.accent_color} onChange={(value) => setForm((prev) => ({ ...prev, accent_color: value }))} />
      </div>

      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={form.hide_loyalup_branding}
          onChange={(event) => setForm((prev) => ({ ...prev, hide_loyalup_branding: event.target.checked }))}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
        />
        Masquer le branding Looyaal
      </label>

      {domainInfo ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
          <p>Domaine: {domainInfo.domain}</p>
          <p className="mt-1 break-all text-zinc-500">Token DNS TXT: {domainInfo.token || '-'}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 ${domainInfo.verified ? 'bg-emerald-900/60 text-emerald-300' : 'bg-amber-900/50 text-amber-300'}`}>
              {domainInfo.verified ? 'Vérifié' : 'Non vérifié'}
            </span>
            <button
              type="button"
              onClick={() => {
                void verifyDomain()
              }}
              disabled={verifying || domainInfo.verified}
              className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {verifying ? 'Vérification...' : 'Vérifier'}
            </button>
          </div>
        </div>
      ) : null}

      {status ? <p className="text-xs text-zinc-400">{status}</p> : null}
    </section>
  )
}

function Field(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-zinc-400">{props.label}</span>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  )
}

function ColorField(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-zinc-400">{props.label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2">
        <input
          type="color"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-6 w-8 rounded border-0 bg-transparent p-0"
        />
        <input
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          className="w-full bg-transparent text-sm text-zinc-100 outline-none"
        />
      </div>
    </label>
  )
}
