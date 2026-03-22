import { Suspense, lazy, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useServiceManager } from '../hooks/useServiceManager'
import type { CreateServiceParams, ServiceItem } from '../services/providerService'

const ServiceForm = lazy(() => import('./ServiceForm').then((module) => ({ default: module.ServiceForm })))

const softButtonClass =
  'rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'

type ImportRow = Omit<CreateServiceParams, 'fournisseur_id'>

type ParsedCsvRow = {
  sourceLine: number
  data: ImportRow
  actif: boolean
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
}

function parseBoolean(value: string | undefined): boolean | null {
  if (value === undefined) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (['1', 'true', 'vrai', 'oui', 'yes', 'active', 'actif'].includes(normalized)) {
    return true
  }

  if (['0', 'false', 'faux', 'non', 'no', 'inactive', 'inactif'].includes(normalized)) {
    return false
  }

  return null
}

function parseNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }

  const normalized = value.trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function pickColumnIndex(headers: string[], aliases: string[]): number {
  const aliasSet = new Set(aliases.map((item) => normalizeHeader(item)))
  return headers.findIndex((header) => aliasSet.has(normalizeHeader(header)))
}

function parseServicesCsv(csvText: string): { rows: ParsedCsvRow[]; errors: string[] } {
  const lines = csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return {
      rows: [],
      errors: ['Le CSV doit contenir un en-tete et au moins une ligne de donnees.'],
    }
  }

  const headerLine = lines[0]
  const delimiter = (headerLine.split(';').length - 1) > (headerLine.split(',').length - 1) ? ';' : ','
  const headers = parseCsvLine(headerLine, delimiter)

  const nomIndex = pickColumnIndex(headers, ['nom', 'name', 'service', 'produit'])
  const emojiIndex = pickColumnIndex(headers, ['emoji', 'icone', 'icon'])
  const prixIndex = pickColumnIndex(headers, ['prix_defaut', 'prix', 'price', 'default_price'])
  const pointsDefautIndex = pickColumnIndex(headers, ['points_defaut', 'points_fixes', 'fixed_points'])
  const pointsPerEuroIndex = pickColumnIndex(headers, ['points_per_euro', 'points_euro', 'points_par_euro'])
  const actifIndex = pickColumnIndex(headers, ['actif', 'active'])

  if (nomIndex < 0) {
    return {
      rows: [],
      errors: [
        'Colonne obligatoire manquante: nom. Exemples d\'en-tete: nom;emoji;prix_defaut;points_defaut;points_per_euro',
      ],
    }
  }

  const rows: ParsedCsvRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i]
    const columns = parseCsvLine(rawLine, delimiter)
    const lineNumber = i + 1

    const nom = (columns[nomIndex] ?? '').trim()
    if (!nom) {
      errors.push(`Ligne ${lineNumber}: nom vide, ligne ignoree.`)
      continue
    }

    const prixDefaut = prixIndex >= 0 ? parseNumber(columns[prixIndex]) : null
    const pointsDefaut = pointsDefautIndex >= 0 ? parseNumber(columns[pointsDefautIndex]) : null
    const pointsPerEuro = pointsPerEuroIndex >= 0 ? parseNumber(columns[pointsPerEuroIndex]) ?? 10 : 10
    const actif = actifIndex >= 0 ? parseBoolean(columns[actifIndex]) : null

    if (pointsPerEuro <= 0) {
      errors.push(`Ligne ${lineNumber}: points_per_euro invalide, utilise 10 par defaut.`)
    }

    rows.push({
      sourceLine: lineNumber,
      actif: actif ?? true,
      data: {
        nom,
        emoji: (emojiIndex >= 0 ? columns[emojiIndex] : '').trim() || '✨',
        prix_defaut: prixDefaut,
        points_defaut: pointsDefaut,
        points_per_euro: pointsPerEuro > 0 ? pointsPerEuro : 10,
      },
    })
  }

  return { rows, errors }
}

export function ServiceManager() {
  const { services, loading, createItem, updateItem, toggleItem } = useServiceManager()
  const [editing, setEditing] = useState<ServiceItem | null>(null)
  const [openCreate, setOpenCreate] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<string | null>(null)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<ParsedCsvRow[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleDownloadTemplate = () => {
    const template = [
      'nom;emoji;prix_defaut;points_defaut;points_per_euro;actif',
      'Soin Premium;✨;49.90;80;10;actif',
      'Pack Decouverte;🎁;29.00;;8;inactif',
      'Massage 30 min;💆;35;;12;oui',
    ].join('\n')

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modele-catalogue-loyalup.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handlePickCsv = () => {
    if (!fileInputRef.current || importing) {
      return
    }

    fileInputRef.current.value = ''
    fileInputRef.current.click()
  }

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const csvText = await file.text()
    const parsed = parseServicesCsv(csvText)

    if (parsed.rows.length === 0) {
      setImportSummary('Aucun service importable trouve dans le fichier.')
      setImportErrors(parsed.errors)
      setPreviewRows([])
      return
    }

    setImportSummary(`${parsed.rows.length} ligne(s) prete(s) a importer. Verifiez l'apercu puis confirmez.`)
    setImportErrors(parsed.errors)
    setPreviewRows(parsed.rows)
  }

  const handleConfirmImport = async () => {
    if (previewRows.length === 0) {
      return
    }

    setImporting(true)
    setImportSummary(null)

    let successCount = 0
    const runtimeErrors = [...importErrors]

    for (const row of previewRows) {
      try {
        const created = await createItem(row.data)
        if (!row.actif) {
          await toggleItem(created.id, false)
        }
        successCount += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erreur inconnue'
        runtimeErrors.push(`Ligne ${row.sourceLine}: ${message}`)
      }
    }

    setImportSummary(`${successCount} service(s) importe(s) sur ${previewRows.length}.`)
    setImportErrors(runtimeErrors)
    setPreviewRows([])
    setImporting(false)
  }

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl font-extrabold text-dark">Services</h3>
          <p className="mt-1 font-body text-xs text-gray-500">Produits et prestations vendus en caisse.</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              handleCsvImport(event).catch(() => {
                setImportSummary('Import CSV echoue.')
                setImportErrors(['Une erreur est survenue lors de la lecture du fichier CSV.'])
                setImporting(false)
              })
            }}
          />
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className={softButtonClass}
          >
            Modele CSV
          </button>
          <button
            type="button"
            onClick={handlePickCsv}
            disabled={importing}
            className={softButtonClass}
          >
            {importing ? 'Import en cours...' : 'Importer CSV'}
          </button>
          <button
            type="button"
            onClick={() => setOpenCreate(true)}
            className="rounded-lg bg-[#FF6B35] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105"
          >
            Ajouter un service
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
        <p className="text-[11px] font-medium text-gray-700">Format CSV attendu: nom;emoji;prix_defaut;points_defaut;points_per_euro;actif</p>
        <p className="mt-1 text-[11px] text-gray-500">Delimiteur accepte: ; ou ,. Seule la colonne nom est obligatoire.</p>
      </div>

      {previewRows.length > 0 ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-blue-900">Apercu avant import</p>
              <p className="text-[11px] text-blue-700">Verifiez les lignes puis confirmez l'import.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={softButtonClass}
                onClick={() => {
                  setPreviewRows([])
                  setImportSummary('Apercu annule.')
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  handleConfirmImport().catch(() => {
                    setImportSummary('Import CSV echoue.')
                    setImportErrors((prev) => [...prev, 'Une erreur est survenue pendant la confirmation.'])
                    setImporting(false)
                  })
                }}
                className="rounded-lg bg-[#FF6B35] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? 'Import en cours...' : `Confirmer l'import (${previewRows.length})`}
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-56 overflow-auto rounded-md border border-blue-100 bg-white">
            <table className="min-w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-blue-100/70 text-blue-900">
                <tr>
                  <th className="px-2 py-1.5">Ligne</th>
                  <th className="px-2 py-1.5">Nom</th>
                  <th className="px-2 py-1.5">Emoji</th>
                  <th className="px-2 py-1.5">Prix</th>
                  <th className="px-2 py-1.5">Pts fixes</th>
                  <th className="px-2 py-1.5">Pts/€</th>
                  <th className="px-2 py-1.5">Etat</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 100).map((row) => (
                  <tr key={`${row.sourceLine}-${row.data.nom}`} className="border-t border-blue-100">
                    <td className="px-2 py-1.5 text-gray-600">{row.sourceLine}</td>
                    <td className="px-2 py-1.5 font-medium text-gray-800">{row.data.nom}</td>
                    <td className="px-2 py-1.5">{row.data.emoji}</td>
                    <td className="px-2 py-1.5">{row.data.prix_defaut ?? '-'}</td>
                    <td className="px-2 py-1.5">{row.data.points_defaut ?? '-'}</td>
                    <td className="px-2 py-1.5">{row.data.points_per_euro}</td>
                    <td className="px-2 py-1.5">{row.actif ? 'Actif' : 'Inactif'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {previewRows.length > 100 ? (
            <p className="mt-2 text-[11px] text-blue-700">Apercu limite aux 100 premieres lignes.</p>
          ) : null}
        </div>
      ) : null}

      {importSummary ? <p className="text-xs font-medium text-gray-700">{importSummary}</p> : null}
      {importErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">Attention sur certaines lignes</p>
          <ul className="mt-1 space-y-1 text-[11px] text-amber-700">
            {importErrors.slice(0, 6).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
          {importErrors.length > 6 ? (
            <p className="mt-1 text-[11px] text-amber-700">{importErrors.length - 6} message(s) supplementaire(s) non affiche(s).</p>
          ) : null}
        </div>
      ) : null}

      {loading ? <p className="text-xs text-gray-500">Chargement...</p> : null}

      <div className="space-y-2">
        {services.map((service) => (
          <article
            key={service.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3 transition hover:-translate-y-[1px] hover:border-[#FF6B35]/40"
          >
            <div className="min-w-0">
              <p className="truncate font-body text-sm font-semibold text-dark">{service.emoji} {service.nom}</p>
              <p className="truncate text-xs text-gray-500">
                {service.prix_defaut !== null ? `${service.prix_defaut} €` : 'Prix libre'} • {service.points_defaut ?? '-'} pts • {service.points_per_euro} pts/€
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toggleItem(service.id, !service.actif).catch(() => null)
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${service.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}
              >
                {service.actif ? 'Actif' : 'Inactif'}
              </button>
              <button type="button" onClick={() => setEditing(service)} className={softButtonClass}>Editer</button>
            </div>
          </article>
        ))}

        {!loading && services.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center">
            <p className="font-body text-sm font-semibold text-gray-700">Aucun service pour le moment</p>
            <p className="mt-1 text-xs text-gray-500">Ajoutez un service pour alimenter votre catalogue.</p>
          </div>
        ) : null}
      </div>

      {openCreate ? (
        <Suspense fallback={null}>
          <ServiceForm
            onSubmit={async (data) => {
              await createItem(data)
            }}
            onCancel={() => setOpenCreate(false)}
          />
        </Suspense>
      ) : null}

      {editing ? (
        <Suspense fallback={null}>
          <ServiceForm
            initialData={editing}
            onSubmit={async (data) => {
              await updateItem(editing.id, data)
            }}
            onCancel={() => setEditing(null)}
          />
        </Suspense>
      ) : null}
    </section>
  )
}
