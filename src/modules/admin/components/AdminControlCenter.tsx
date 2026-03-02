import { useEffect, useMemo, useState, type ChangeEventHandler } from 'react'
import {
  bulkImportAdminUsers,
  bulkUpdateAdminUsers,
  deleteScanAd,
  getAdminAuditLogs,
  getAdminApiUsage,
  getAdminOverview,
  getAdminWebhookFailures,
  impersonateAdminUser,
  listScanAds,
  listAdminUsers,
  retryAdminWebhookDelivery,
  upsertScanAd,
  toggleAdminUserBlock,
  updateAdminProviderTier,
  updateAdminUserRole,
  type AdminAuditLogRow,
  type AdminOverview,
  type AdminUserRow,
  type ApiUsageRow,
  type ScanAdRow,
  type WebhookFailureRow,
} from '../services/adminConsoleService'

export type AdminTab = 'overview' | 'users' | 'api' | 'webhooks' | 'audit' | 'ads'

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'api', label: 'API Ops' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit', label: 'Audit' },
  { key: 'ads', label: 'Ads' },
]

const secondaryButtonClass =
  'rounded-xl border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#3F3F46]'

export function AdminControlCenter(props: { initialTab?: AdminTab }) {
  const [activeTab, setActiveTab] = useState<AdminTab>(props.initialTab ?? 'overview')
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [bulkRole, setBulkRole] = useState<'client' | 'fournisseur' | 'admin'>('client')
  const [importing, setImporting] = useState(false)

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [apiUsage, setApiUsage] = useState<ApiUsageRow[]>([])
  const [webhookFailures, setWebhookFailures] = useState<WebhookFailureRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([])
  const [scanAds, setScanAds] = useState<ScanAdRow[]>([])
  const [editingAdId, setEditingAdId] = useState<string | null>(null)
  const [adTitle, setAdTitle] = useState('')
  const [adBody, setAdBody] = useState('')
  const [adCtaLabel, setAdCtaLabel] = useState('')
  const [adCtaUrl, setAdCtaUrl] = useState('')
  const [adDisplayOrder, setAdDisplayOrder] = useState(0)
  const [adActive, setAdActive] = useState(true)

  const apiErrorRate = useMemo(() => {
    if (apiUsage.length === 0) {
      return 0
    }

    const errors = apiUsage.filter((row) => (row.status_code ?? 200) >= 400).length
    return (errors / apiUsage.length) * 100
  }, [apiUsage])

  const loadAll = async () => {
    setLoading(true)
    setStatus('')

    try {
      const [nextOverview, nextUsers, nextUsage, nextFailures, nextAuditLogs, nextScanAds] = await Promise.all([
        getAdminOverview(),
        listAdminUsers({ page: 1, limit: 50, search }),
        getAdminApiUsage(200),
        getAdminWebhookFailures(150),
        getAdminAuditLogs(150),
        listScanAds(),
      ])

      setOverview(nextOverview)
      setUsers(nextUsers)
      setSelectedUserIds([])
      setApiUsage(nextUsage)
      setWebhookFailures(nextFailures)
      setAuditLogs(nextAuditLogs)
      setScanAds(nextScanAds)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to load admin data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [search])

  const exportCsv = (rows: Record<string, unknown>[], filename: string) => {
    if (rows.length === 0) {
      setStatus('No data to export')
      return
    }

    const headers = Object.keys(rows[0])
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header]
            const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
            return `"${text.replaceAll('"', '""')}"`
          })
          .join(','),
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportFile: ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    setImporting(true)
    setStatus('')

    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      const rows = parseCsvRows(content)

      if (rows.length === 0) {
        setImporting(false)
        setStatus('CSV import failed: no rows found')
        return
      }

      void bulkImportAdminUsers(rows)
        .then((result) => {
          setStatus(
            `Import completed: ${result.summary.succeeded}/${result.summary.total} succeeded, ${result.summary.failed} failed`,
          )
          return loadAll()
        })
        .catch((error) => setStatus(error instanceof Error ? error.message : 'CSV import failed'))
        .finally(() => setImporting(false))
    }

    reader.onerror = () => {
      setImporting(false)
      setStatus('CSV import failed: unable to read file')
    }

    reader.readAsText(file)
  }

  const filteredUsers = users.filter((user) => {
    if (!search) {
      return true
    }

    const keyword = search.toLowerCase()
    return (
      user.email.toLowerCase().includes(keyword) ||
      user.nom.toLowerCase().includes(keyword) ||
      user.role.toLowerCase().includes(keyword)
    )
  })

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id))

  const selectedCount = selectedUserIds.length

  useEffect(() => {
    if (props.initialTab && props.initialTab !== activeTab) {
      setActiveTab(props.initialTab)
    }
  }, [activeTab, props.initialTab])

  const resetAdForm = () => {
    setEditingAdId(null)
    setAdTitle('')
    setAdBody('')
    setAdCtaLabel('')
    setAdCtaUrl('')
    setAdDisplayOrder(0)
    setAdActive(true)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-4 text-sm text-[#D4D4D8]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#A1A1AA]">Admin Control Center</h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
          />
          <button
            type="button"
            onClick={() => {
              void loadAll()
            }}
            className={secondaryButtonClass}
          >
            Refresh
          </button>
        </div>
      </div>

      {!props.initialTab ? (
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-[#106EBE]/35 text-[#D7ECFF] shadow-sm'
                  : 'border border-slate-500/25 text-slate-200 hover:border-[#50B0FF]/50 hover:bg-[#106EBE]/15 hover:text-[#D7ECFF]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <div className="h-16 animate-pulse rounded-md bg-white/5" /> : null}

      {activeTab === 'overview' ? (
        <div className="grid gap-6 md:grid-cols-4">
          <Card label="Total users" value={String(overview?.total_users ?? 0)} />
          <Card label="Admins" value={String(overview?.admins ?? 0)} />
          <Card label="API errors" value={String(overview?.api_errors ?? 0)} />
          <Card label="Webhook failures" value={String(overview?.failed_webhook_deliveries ?? 0)} />
        </div>
      ) : null}

      {activeTab === 'users' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportCsv(filteredUsers as unknown as Record<string, unknown>[], 'admin-users.csv')}
              className={secondaryButtonClass}
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedUserIds(allFilteredSelected ? [] : filteredUsers.map((user) => user.id))
              }}
              className={secondaryButtonClass}
            >
              {allFilteredSelected ? 'Unselect all' : 'Select all'}
            </button>
            <label className={`${secondaryButtonClass} cursor-pointer`}>
              {importing ? 'Importing…' : 'Import CSV'}
              <input type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" disabled={importing} />
            </label>
          </div>

          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-2">
            <p className="text-xs text-slate-200">Selected: {selectedCount}</p>

            <select
              value={bulkRole}
              onChange={(event) => setBulkRole(event.target.value as 'client' | 'fournisseur' | 'admin')}
              className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
            >
              <option value="client">client</option>
              <option value="fournisseur">fournisseur</option>
              <option value="admin">admin</option>
            </select>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                void bulkUpdateAdminUsers({ user_ids: selectedUserIds, role: bulkRole })
                  .then(() => {
                    setStatus(`Bulk role update applied to ${selectedCount} users`)
                    return loadAll()
                  })
                  .catch((error) => setStatus(error instanceof Error ? error.message : 'Bulk role update failed'))
              }}
              className={`${secondaryButtonClass} disabled:opacity-60`}
            >
              Apply role
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                void bulkUpdateAdminUsers({ user_ids: selectedUserIds, blocked: true })
                  .then(() => {
                    setStatus(`Blocked ${selectedCount} users`)
                    return loadAll()
                  })
                  .catch((error) => setStatus(error instanceof Error ? error.message : 'Bulk block failed'))
              }}
              className={`${secondaryButtonClass} disabled:opacity-60`}
            >
              Block selected
            </button>

            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                void bulkUpdateAdminUsers({ user_ids: selectedUserIds, blocked: false })
                  .then(() => {
                    setStatus(`Unblocked ${selectedCount} users`)
                    return loadAll()
                  })
                  .catch((error) => setStatus(error instanceof Error ? error.message : 'Bulk unblock failed'))
              }}
              className={`${secondaryButtonClass} disabled:opacity-60`}
            >
              Unblock selected
            </button>
          </div>

          <div className="space-y-2">
            {filteredUsers.map((user) => (
              <article key={user.id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={(event) => {
                        setSelectedUserIds((prev) =>
                          event.target.checked ? Array.from(new Set([...prev, user.id])) : prev.filter((id) => id !== user.id),
                        )
                      }}
                      className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-950"
                    />

                    <div>
                    <p className="font-medium text-white">{user.nom || user.email}</p>
                    <p className="text-xs text-slate-200">{user.email}</p>
                    {user.provider_tier ? <p className="text-xs text-slate-200">tier: {user.provider_tier}</p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(event) => {
                        const nextRole = event.target.value as 'client' | 'fournisseur' | 'admin'
                        void updateAdminUserRole(user.id, nextRole)
                          .then(() => {
                            setStatus('User role updated')
                            return loadAll()
                          })
                          .catch((error) => setStatus(error instanceof Error ? error.message : 'Role update failed'))
                      }}
                      className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
                    >
                      <option value="client">client</option>
                      <option value="fournisseur">fournisseur</option>
                      <option value="admin">admin</option>
                    </select>

                    {user.role === 'fournisseur' ? (
                      <select
                        value={user.provider_tier ?? 'free'}
                        onChange={(event) => {
                          const nextTier = event.target.value as 'free' | 'starter' | 'premium' | 'enterprise'
                          void updateAdminProviderTier(user.id, nextTier)
                            .then(() => {
                              setStatus('Provider tier updated')
                              return loadAll()
                            })
                            .catch((error) => setStatus(error instanceof Error ? error.message : 'Tier update failed'))
                        }}
                        className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
                      >
                        <option value="free">free</option>
                        <option value="starter">starter</option>
                        <option value="premium">premium</option>
                        <option value="enterprise">enterprise</option>
                      </select>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        void toggleAdminUserBlock(user.id, !user.blocked)
                          .then(() => {
                            setStatus(user.blocked ? 'User enabled' : 'User blocked')
                            return loadAll()
                          })
                          .catch((error) => setStatus(error instanceof Error ? error.message : 'Block toggle failed'))
                      }}
                      className={secondaryButtonClass}
                    >
                      {user.blocked ? 'Enable' : 'Disable'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void impersonateAdminUser(user.id)
                          .then((url) => {
                            if (!url) {
                              setStatus('No impersonation link returned')
                              return
                            }
                            window.open(url, '_blank', 'noopener,noreferrer')
                            setStatus('Impersonation link opened')
                          })
                          .catch((error) => setStatus(error instanceof Error ? error.message : 'Impersonation failed'))
                      }}
                      className={secondaryButtonClass}
                    >
                      Impersonate
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'api' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-200">Error rate: {apiErrorRate.toFixed(1)}%</p>
            <button
              type="button"
              onClick={() => exportCsv(apiUsage as unknown as Record<string, unknown>[], 'admin-api-usage.csv')}
              className={secondaryButtonClass}
            >
              Export CSV
            </button>
          </div>

          {apiUsage.slice(0, 50).map((row) => (
            <article key={row.id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-white">{row.method} {row.endpoint}</p>
                <p className={(row.status_code ?? 200) >= 400 ? 'text-red-400' : 'text-[#7CC6FF]'}>{row.status_code ?? '-'}</p>
              </div>
              <p className="text-slate-200">{new Date(row.created_at).toLocaleString('fr-FR')} • {row.response_time_ms ?? 0} ms • {row.ip_address ?? '-'}</p>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'webhooks' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => exportCsv(webhookFailures as unknown as Record<string, unknown>[], 'admin-webhook-failures.csv')}
              className={secondaryButtonClass}
            >
              Export CSV
            </button>
          </div>

          {webhookFailures.slice(0, 50).map((row) => (
            <article key={row.id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-white">{row.event_type}</p>
                <button
                  type="button"
                  onClick={() => {
                    void retryAdminWebhookDelivery(row.id)
                      .then(() => {
                        setStatus('Webhook delivery retried')
                        return loadAll()
                      })
                      .catch((error) => setStatus(error instanceof Error ? error.message : 'Retry failed'))
                  }}
                  className={secondaryButtonClass}
                >
                  Retry
                </button>
              </div>
              <p className="text-slate-200">status: {row.response_status ?? '-'} • attempts: {row.attempt_number} • {new Date(row.delivered_at).toLocaleString('fr-FR')}</p>
              <p className="mt-1 line-clamp-2 text-slate-200">{row.response_body ?? ''}</p>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'audit' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => exportCsv(auditLogs as unknown as Record<string, unknown>[], 'admin-audit-logs.csv')}
              className={secondaryButtonClass}
            >
              Export CSV
            </button>
          </div>

          {auditLogs.slice(0, 80).map((log) => (
            <article key={log.id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={log.success ? 'text-[#7CC6FF]' : 'text-red-400'}>{log.action}</p>
                <p className="text-slate-200">{new Date(log.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="text-slate-200">admin: {log.admin_user_id} {log.target_user_id ? `• target: ${log.target_user_id}` : ''}</p>
              <p className="mt-1 line-clamp-2 text-slate-200">{JSON.stringify(log.metadata ?? {})}</p>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'ads' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3">
            <p className="mb-2 text-xs text-slate-200">{editingAdId ? 'Modifier une pub' : 'Nouvelle pub écran scan'}</p>

            <div className="grid gap-2 md:grid-cols-2">
              <input
                value={adTitle}
                onChange={(event) => setAdTitle(event.target.value)}
                placeholder="Titre"
                className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
              />
              <input
                value={adCtaLabel}
                onChange={(event) => setAdCtaLabel(event.target.value)}
                placeholder="CTA (optionnel)"
                className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
              />
              <input
                value={adBody}
                onChange={(event) => setAdBody(event.target.value)}
                placeholder="Message"
                className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8] md:col-span-2"
              />
              <input
                value={adCtaUrl}
                onChange={(event) => setAdCtaUrl(event.target.value)}
                placeholder="URL CTA (https://...)"
                className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
              />
              <input
                type="number"
                value={adDisplayOrder}
                onChange={(event) => setAdDisplayOrder(Number(event.target.value))}
                placeholder="Ordre"
                className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#27272A] px-2 py-1 text-xs text-[#D4D4D8]"
              />
            </div>

            <label className="mt-2 flex items-center gap-2 text-xs text-slate-200">
              <input
                type="checkbox"
                checked={adActive}
                onChange={(event) => setAdActive(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-950"
              />
              Active
            </label>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void upsertScanAd({
                    id: editingAdId ?? undefined,
                    title: adTitle,
                    body: adBody,
                    cta_label: adCtaLabel || null,
                    cta_url: adCtaUrl || null,
                    active: adActive,
                    display_order: adDisplayOrder,
                  })
                    .then(() => {
                      setStatus(editingAdId ? 'Pub mise à jour' : 'Pub créée')
                      resetAdForm()
                      return loadAll()
                    })
                    .catch((error) => setStatus(error instanceof Error ? error.message : 'Ad save failed'))
                }}
                className={secondaryButtonClass}
              >
                {editingAdId ? 'Mettre à jour' : 'Créer'}
              </button>

              {editingAdId ? (
                <button type="button" onClick={resetAdForm} className={secondaryButtonClass}>
                  Annuler
                </button>
              ) : null}
            </div>
          </div>

          {scanAds.map((ad) => (
            <article key={ad.id} className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{ad.title}</p>
                  <p className="text-slate-200">{ad.body}</p>
                  <p className="mt-1 text-slate-300">ordre: {ad.display_order} • {ad.active ? 'active' : 'inactive'}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAdId(ad.id)
                      setAdTitle(ad.title)
                      setAdBody(ad.body)
                      setAdCtaLabel(ad.cta_label ?? '')
                      setAdCtaUrl(ad.cta_url ?? '')
                      setAdDisplayOrder(ad.display_order)
                      setAdActive(ad.active)
                    }}
                    className={secondaryButtonClass}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void upsertScanAd({
                        id: ad.id,
                        title: ad.title,
                        body: ad.body,
                        cta_label: ad.cta_label,
                        cta_url: ad.cta_url,
                        active: !ad.active,
                        display_order: ad.display_order,
                        starts_at: ad.starts_at,
                        ends_at: ad.ends_at,
                      })
                        .then(() => {
                          setStatus(ad.active ? 'Pub désactivée' : 'Pub activée')
                          return loadAll()
                        })
                        .catch((error) => setStatus(error instanceof Error ? error.message : 'Ad toggle failed'))
                    }}
                    className={secondaryButtonClass}
                  >
                    {ad.active ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void deleteScanAd(ad.id)
                        .then(() => {
                          setStatus('Pub supprimée')
                          if (editingAdId === ad.id) {
                            resetAdForm()
                          }
                          return loadAll()
                        })
                        .catch((error) => setStatus(error instanceof Error ? error.message : 'Ad delete failed'))
                    }}
                    className={secondaryButtonClass}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {status ? <p className="text-xs text-slate-200">{status}</p> : null}
    </div>
  )
}

function Card(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#18181B] p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(80,176,255,0.35)] hover:shadow-[0_10px_24px_rgba(0,120,212,0.2)]">
      <p className="text-xs font-medium text-[#71717A]">{props.label}</p>
      <p className="mt-1 text-[28px] font-bold text-[#FAFAFA]">{props.value}</p>
    </div>
  )
}

function parseCsvRows(text: string): Array<Record<string, unknown>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return []
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase())
  const rows: Array<Record<string, unknown>> = []

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index])
    const row: Record<string, unknown> = {}

    headers.forEach((header, position) => {
      const rawValue = values[position]?.trim() ?? ''
      if (!rawValue) {
        return
      }

      if (header === 'blocked') {
        const normalized = rawValue.toLowerCase()
        row.blocked = ['true', '1', 'yes', 'y'].includes(normalized)
        return
      }

      row[header] = rawValue
    })

    if (Object.keys(row).length > 0) {
      rows.push(row)
    }
  }

  return rows
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}
