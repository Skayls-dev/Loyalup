import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { listSystemSecrets, setSystemSecret, testSystemSecretsConfig, type SystemSecretItem } from '../../modules/admin/services/adminConsoleService'

function formatDate(value: string | null): string {
  if (!value) return 'Jamais'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('fr-FR')
}

export default function AdminSecretsPage() {
  const { profile, role, user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedName, setSelectedName] = useState('SUMUP_CLIENT_ID')
  const [secretValue, setSecretValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [testingConfig, setTestingConfig] = useState(false)
  const [configResult, setConfigResult] = useState<{
    success: boolean
    config_ok: boolean
    project_ref: string | null
    can_access_management_api: boolean
    status?: number
    detail?: string
    missing?: {
      management_token?: boolean
      project_ref?: boolean
    }
  } | null>(null)
  const [configStatus, setConfigStatus] = useState<{
    ok: boolean
    message: string
  } | null>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const metadataRole = String(user?.app_metadata?.role ?? user?.user_metadata?.role ?? '').trim()
  const metadataSuperAdmin = Boolean(user?.app_metadata?.super_admin ?? user?.user_metadata?.super_admin)
  const isSuperAdmin =
    role === 'super_admin'
    || profile?.role === 'super_admin'
    || metadataRole === 'super_admin'
    || metadataSuperAdmin

  const secretsQuery = useQuery({
    queryKey: ['admin-system-secrets'],
    queryFn: listSystemSecrets,
    enabled: isSuperAdmin,
    staleTime: 30_000,
  })

  const knownNames = useMemo(() => {
    const names = (secretsQuery.data ?? []).map((item) => item.name)
    return names.length > 0 ? names : [
      'SUMUP_CLIENT_ID',
      'SUMUP_CLIENT_SECRET',
      'SUMUP_REDIRECT_URI',
      'SUMUP_OAUTH_SCOPES',
      'SUMUP_SANDBOX_API_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]
  }, [secretsQuery.data])

  const selectedMeta: SystemSecretItem | null = (secretsQuery.data ?? []).find((item) => item.name === selectedName) ?? null

  if (!isSuperAdmin) {
    return (
      <section className="space-y-4">
        <header>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Secrets système</h1>
          <p className="mt-1 text-sm text-slate-500">Accès réservé aux comptes super_admin.</p>
        </header>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-semibold">Permissions insuffisantes</p>
              <p className="mt-1 text-sm">Seuls les super_admin peuvent consulter et mettre à jour les secrets d&apos;infrastructure.</p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Secrets système</h1>
          <p className="mt-1 text-sm text-slate-500">Gestion sécurisée des secrets Supabase (valeurs jamais affichées).</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setTestingConfig(true)
              setConfigStatus(null)
              setConfigResult(null)
              try {
                const result = await testSystemSecretsConfig()
                setConfigResult(result)
                if (result.config_ok) {
                  setConfigStatus({
                    ok: true,
                    message: `Configuration valide (project_ref: ${result.project_ref ?? 'n/a'}).`,
                  })
                } else if (result.missing?.management_token) {
                  setConfigStatus({
                    ok: false,
                    message: 'Configuration invalide: SUPABASE_MANAGEMENT_API_TOKEN manquant.',
                  })
                } else {
                  setConfigStatus({
                    ok: false,
                    message: `Accès API management impossible (${result.status ?? 'n/a'}). Vérifiez le PAT et les permissions.`,
                  })
                }
              } catch (error) {
                setConfigStatus({
                  ok: false,
                  message: error instanceof Error ? error.message : 'Test de configuration impossible',
                })
              } finally {
                setTestingConfig(false)
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ShieldAlert className="h-4 w-4" />
            {testingConfig ? 'Test…' : 'Tester la config'}
          </button>
          <button
            type="button"
            onClick={() => void secretsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </button>
        </div>
      </header>

      {configStatus ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${configStatus.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <p>{configStatus.message}</p>

          {configResult ? (
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider opacity-90">
                Détails techniques
              </summary>
              <div className="mt-2 grid grid-cols-1 gap-1 rounded-lg border border-black/10 bg-white/50 p-2 text-xs">
                <div><span className="font-semibold">project_ref:</span> {configResult.project_ref ?? 'n/a'}</div>
                <div><span className="font-semibold">config_ok:</span> {String(configResult.config_ok)}</div>
                <div><span className="font-semibold">management_api:</span> {String(configResult.can_access_management_api)}</div>
                <div><span className="font-semibold">http_status:</span> {String(configResult.status ?? 'n/a')}</div>
                <div><span className="font-semibold">missing.management_token:</span> {String(Boolean(configResult.missing?.management_token))}</div>
                <div><span className="font-semibold">missing.project_ref:</span> {String(Boolean(configResult.missing?.project_ref))}</div>
                {configResult.detail ? (
                  <div className="break-all">
                    <span className="font-semibold">detail:</span> {configResult.detail}
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <KeyRound className="h-4 w-4" />
            <h2 className="text-base font-semibold">État des secrets autorisés</h2>
          </div>

          {secretsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(secretsQuery.data ?? []).map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Mise à jour: {formatDate(item.updated_at)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${item.is_set ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.is_set ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {item.is_set ? 'Configuré' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Mettre à jour un secret</h2>
          <p className="mt-1 text-sm text-slate-500">La nouvelle valeur est écrite dans Supabase Secrets. Elle n&apos;est jamais relue en clair.</p>

          <form
            className="mt-4 space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              setStatus(null)

              if (!selectedName || !secretValue.trim()) {
                setStatus({ type: 'error', message: 'Sélectionnez un secret et saisissez une valeur non vide.' })
                return
              }

              setBusy(true)
              try {
                await setSystemSecret(selectedName, secretValue)
                setSecretValue('')
                setStatus({ type: 'success', message: `Secret ${selectedName} mis à jour.` })
                await queryClient.invalidateQueries({ queryKey: ['admin-system-secrets'] })
              } catch (error) {
                setStatus({
                  type: 'error',
                  message: error instanceof Error ? error.message : 'Impossible de mettre à jour le secret',
                })
              } finally {
                setBusy(false)
              }
            }}
          >
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Nom du secret</span>
              <select
                value={selectedName}
                onChange={(event) => setSelectedName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {knownNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Nouvelle valeur</span>
              <textarea
                value={secretValue}
                onChange={(event) => setSecretValue(event.target.value)}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Collez la nouvelle valeur"
              />
            </label>

            {selectedMeta ? (
              <p className="text-xs text-slate-500">
                Dernière mise à jour connue: {formatDate(selectedMeta.updated_at)}
              </p>
            ) : null}

            {status ? (
              <div className={`rounded-lg border px-3 py-2 text-sm ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                {status.message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? 'Mise à jour…' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
