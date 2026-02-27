import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function DataExportButton() {
  const [loading, setLoading] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('export-user-data', {
        method: 'POST',
      })

      if (invokeError) {
        throw invokeError
      }

      setDownloadUrl(data?.download_url ?? null)
      setExpiresAt(data?.expires_at ?? null)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Erreur export')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Portabilité des données</p>
          <p className="text-xs text-zinc-400">Conforme RGPD · Art. 20</p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={loading}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-70"
        >
          {loading ? 'Génération...' : 'Télécharger mes données'}
        </button>
      </div>

      {downloadUrl ? (
        <div className="mt-3 text-xs text-zinc-300">
          <a href={downloadUrl} className="text-blue-400 hover:text-blue-300" target="_blank" rel="noreferrer">
            Télécharger l’export
          </a>
          {expiresAt ? <p className="mt-1 text-zinc-500">Expire le {new Date(expiresAt).toLocaleString('fr-FR')}</p> : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
    </section>
  )
}
