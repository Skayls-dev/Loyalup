import { useEffect, useMemo, useState, type ChangeEventHandler } from 'react'
import { InstitutionAccessManager } from './InstitutionAccessManager'
import { ScanAdsManager } from './ScanAdsManager'
import {
  bulkImportAdminUsers,
  bulkUpdateAdminUsers,
  deleteAdminUser,
  getAdminAuditLogs,
  getAdminApiUsage,
  getAdminOverview,
  getAdminWebhookFailures,
  generatePartnerKey,
  impersonateAdminUser,
  listPartnerTransfers,
  listPartnerAccessRequests,
  listPartners,
  listAdminUsers,
  getUserProviderRelations,
  retryAdminWebhookDelivery,
  resetAdminUserPassword,
  setAdminUserTemporaryPassword,
  reviewPartnerAccessRequest,
  upsertPartner,
  toggleAdminUserBlock,
  updateAdminProviderTier,
  updateAdminUserRole,
  type AdminAuditLogRow,
  type AdminOverview,
  type AdminUserProviderRelations,
  type AdminUserRow,
  type ApiUsageRow,
  type PartnerTransferRow,
  type PartnerRow,
  type PartnerAccessRequestRow,
  type WebhookFailureRow,
} from '../services/adminConsoleService'

export type AdminTab = 'overview' | 'users' | 'api' | 'webhooks' | 'audit' | 'ads' | 'institutions'

const tabs: Array<{ key: AdminTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'users', label: 'Users' },
  { key: 'api', label: 'API Ops' },
  { key: 'webhooks', label: 'Webhooks' },
  { key: 'audit', label: 'Audit' },
  { key: 'ads', label: 'Ads' },
  { key: 'institutions', label: 'Institutions' },
]

const primaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-60'

const secondaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-white px-3 text-xs font-semibold text-[#0078D4] transition hover:bg-[#f3f2f1] disabled:opacity-60'

const inputClass =
  'h-8 rounded border border-[#d2d0ce] bg-white px-2 text-xs text-[#323130] placeholder:text-[#8a8886]'

const panelClass = 'rounded-md border border-[#edebe9] bg-white p-4 shadow-sm'

const rowClass =
  'rounded-md border border-[#edebe9] bg-white p-3 text-xs text-[#323130] transition hover:bg-[#f3f2f1]'

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
  const [partnerTransfers, setPartnerTransfers] = useState<PartnerTransferRow[]>([])
  const [transferSearch, setTransferSearch] = useState('')
  const [transferStatusFilter, setTransferStatusFilter] = useState<'all' | 'accepted' | 'rejected' | 'pending'>('all')
  const [webhookFailures, setWebhookFailures] = useState<WebhookFailureRow[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRow[]>([])
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [partnerAccessRequests, setPartnerAccessRequests] = useState<PartnerAccessRequestRow[]>([])
  const [partnerCode, setPartnerCode] = useState('')
  const [partnerName, setPartnerName] = useState('')
  const [partnerStatus, setPartnerStatus] = useState<'draft' | 'sandbox_active' | 'production_active' | 'suspended'>('draft')
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [partnerKeyEnv, setPartnerKeyEnv] = useState<'sandbox' | 'production'>('sandbox')
  const [partnerScopes, setPartnerScopes] = useState('transfers:write')
  const [generatedPartnerKey, setGeneratedPartnerKey] = useState('')
  const [generatedTempPassword, setGeneratedTempPassword] = useState('')
  const [generatedTempPasswordUser, setGeneratedTempPasswordUser] = useState('')
  const [generatingPartnerKey, setGeneratingPartnerKey] = useState(false)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AdminUserRow | null>(null)
  const [confirmTempPasswordUser, setConfirmTempPasswordUser] = useState<AdminUserRow | null>(null)
  const [confirmResetLinkUser, setConfirmResetLinkUser] = useState<AdminUserRow | null>(null)
  const [confirmCopyResetLinkUser, setConfirmCopyResetLinkUser] = useState<AdminUserRow | null>(null)
  const [tempPasswordModal, setTempPasswordModal] = useState<{ userLabel: string; password: string } | null>(null)
  const [relationsLoading, setRelationsLoading] = useState(false)
  const [relationsUserId, setRelationsUserId] = useState<string | null>(null)
  const [relationsData, setRelationsData] = useState<AdminUserProviderRelations | null>(null)
  const [relationsSearch, setRelationsSearch] = useState('')

  const handleDeleteUser = async (user: AdminUserRow) => {
    await deleteAdminUser(user.id)
    setStatus('User deleted')
    await loadAll()
  }

  const handleGenerateTempPassword = async (user: AdminUserRow) => {
    const temporaryPassword = await setAdminUserTemporaryPassword(user.id)
    if (!temporaryPassword) {
      setStatus('No temporary password returned')
      return
    }

    setGeneratedTempPassword(temporaryPassword)
    setGeneratedTempPasswordUser(user.email || user.id)
    setTempPasswordModal({ userLabel: user.email || user.id, password: temporaryPassword })

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(temporaryPassword).catch(() => undefined)
    }

    setStatus('Temporary password generated, displayed, and copied. User must change it on first login.')
  }

  const handleGenerateResetLink = async (user: AdminUserRow) => {
    const resetLink = await resetAdminUserPassword(user.id)
    if (!resetLink) {
      setStatus('No reset link returned')
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(resetLink).catch(() => undefined)
    }

    window.open(resetLink, '_blank', 'noopener,noreferrer')
    setStatus('Password reset link generated (copied/opened)')
  }

  const handleCopyResetLink = async (user: AdminUserRow) => {
    const resetLink = await resetAdminUserPassword(user.id)
    if (!resetLink) {
      setStatus('No reset link returned')
      return
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(resetLink)
      setStatus('Password reset link copied')
      return
    }

    setStatus('Clipboard unavailable: open reset link then copy manually')
  }

  const apiErrorRate = useMemo(() => {
    if (apiUsage.length === 0) {
      return 0
    }

    const errors = apiUsage.filter((row) => (row.status_code ?? 200) >= 400).length
    return (errors / apiUsage.length) * 100
  }, [apiUsage])

  const transferApiCalls = useMemo(
    () => apiUsage.filter((row) => /transfer/i.test(row.endpoint)),
    [apiUsage],
  )

  const filteredPartnerTransfers = useMemo(() => {
    const keyword = transferSearch.trim().toLowerCase()

    return partnerTransfers.filter((row) => {
      if (transferStatusFilter !== 'all' && row.status !== transferStatusFilter) {
        return false
      }

      if (!keyword) {
        return true
      }

      return [
        row.external_user_id,
        row.loyalup_user_email,
        row.transaction_ref,
        row.partner_id,
        row.loyalup_user_id,
        row.error_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    })
  }, [partnerTransfers, transferSearch, transferStatusFilter])

  const loadAll = async () => {
    setLoading(true)
    setStatus('')

    try {
      const [nextOverview, nextUsers, nextUsage, nextTransfers, nextFailures, nextAuditLogs] = await Promise.all([
        getAdminOverview(),
        listAdminUsers({ page: 1, limit: 50, search }),
        getAdminApiUsage(500),
        listPartnerTransfers({ limit: 500 }),
        getAdminWebhookFailures(150),
        getAdminAuditLogs(150),
      ])

      setOverview(nextOverview)
      setUsers(nextUsers)
      setSelectedUserIds([])
      setApiUsage(nextUsage)
      setPartnerTransfers(nextTransfers)
      setWebhookFailures(nextFailures)
      setAuditLogs(nextAuditLogs)

      // Optional modules should not block core admin/user management flows.
      const [partnersResult, partnerRequestsResult] = await Promise.allSettled([
        listPartners(),
        listPartnerAccessRequests('pending'),
      ])

      if (partnersResult.status === 'fulfilled') {
        setPartners(partnersResult.value)
        if (!selectedPartnerId && partnersResult.value.length > 0) {
          setSelectedPartnerId(partnersResult.value[0].id)
        }
      } else {
        setPartners([])
      }

      if (partnerRequestsResult.status === 'fulfilled') {
        setPartnerAccessRequests(partnerRequestsResult.value)
      } else {
        setPartnerAccessRequests([])
      }
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

  return (
    <div className="space-y-4 rounded-md border border-[#edebe9] bg-white p-5 text-sm text-[#323130] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[17px] font-semibold text-[#323130]">Admin Control Center</h3>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search users"
            className={inputClass}
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
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === tab.key
                  ? 'border-[#0078D4] bg-[#0078D4] text-white'
                  : 'border-[#d2d0ce] bg-white text-[#323130] hover:bg-[#f3f2f1]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <div className="h-16 animate-pulse rounded-md border border-[#edebe9] bg-[#faf9f8]" /> : null}

      {activeTab === 'overview' ? (
        <div className="grid gap-4 md:grid-cols-4">
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

          <div className={`${panelClass} space-y-2`}>
            <p className="text-xs text-[#605E5C]">Selected: {selectedCount}</p>

            <select
              value={bulkRole}
              onChange={(event) => setBulkRole(event.target.value as 'client' | 'fournisseur' | 'admin')}
              className={inputClass}
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
            <div className="grid grid-cols-[2fr_3fr_2fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
              <span>Identity</span>
              <span>Email</span>
              <span>Actions</span>
            </div>

            {relationsData ? (
              <div className={`${panelClass} space-y-2`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#605E5C]">
                    Relations for {relationsData.subject.nom || relationsData.subject.email || relationsData.subject.user_id}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRelationsData(null)
                      setRelationsUserId(null)
                      setRelationsSearch('')
                    }}
                    className={secondaryButtonClass}
                  >
                    Close
                  </button>
                </div>

                <input
                  value={relationsSearch}
                  onChange={(event) => setRelationsSearch(event.target.value)}
                  placeholder="Filter relations: provider name, user email, client name"
                  className={inputClass}
                />

                {(() => {
                  const keyword = relationsSearch.trim().toLowerCase()
                  const filteredProviders = keyword
                    ? relationsData.providers.filter((provider) =>
                        [provider.nom_commerce, provider.provider_user_id, provider.fournisseur_id]
                          .filter(Boolean)
                          .some((value) => String(value).toLowerCase().includes(keyword)),
                      )
                    : relationsData.providers

                  const filteredClients = keyword
                    ? relationsData.clients.filter((client) =>
                        [client.nom, client.email, client.client_id]
                          .filter(Boolean)
                          .some((value) => String(value).toLowerCase().includes(keyword)),
                      )
                    : relationsData.clients

                  return (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="rounded border border-[#edebe9] bg-[#faf9f8] p-2">
                        <p className="text-xs font-semibold text-[#323130]">
                          User → Providers ({filteredProviders.length}/{relationsData.totals.providers_count})
                        </p>
                        {filteredProviders.length === 0 ? (
                          <p className="mt-1 text-xs text-[#605E5C]">No linked providers found.</p>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {filteredProviders.map((provider) => (
                              <div key={`${relationsData.subject.user_id}-${provider.fournisseur_id}`} className="rounded border border-[#edebe9] bg-white p-2 text-xs text-[#323130]">
                                <p className="font-semibold">{provider.nom_commerce || provider.fournisseur_id}</p>
                                <p className="text-[#605E5C]">tier: {provider.tier ?? 'n/a'} • balance: {provider.solde} • visits: {provider.total_visites}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded border border-[#edebe9] bg-[#faf9f8] p-2">
                        <p className="text-xs font-semibold text-[#323130]">
                          Provider → Looyaal users ({filteredClients.length}/{relationsData.totals.clients_count})
                        </p>
                        {filteredClients.length === 0 ? (
                          <p className="mt-1 text-xs text-[#605E5C]">No linked Looyaal users found.</p>
                        ) : (
                          <div className="mt-1 space-y-1">
                            {filteredClients.map((client) => (
                              <div key={`${relationsData.subject.user_id}-${client.client_id}`} className="rounded border border-[#edebe9] bg-white p-2 text-xs text-[#323130]">
                                <p className="font-semibold">{client.nom || client.email || client.client_id}</p>
                                <p className="text-[#605E5C]">{client.email || 'no email'} • balance: {client.solde} • visits: {client.total_visites}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}

            {filteredUsers.map((user) => (
              <article key={user.id} className={rowClass}>
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
                      className="mt-1 h-4 w-4 rounded border-[#c8c6c4]"
                    />

                    <div>
                    <p className="font-medium text-[#323130]">{user.nom || user.email}</p>
                    <p className="text-xs text-[#605E5C]">{user.email}</p>
                    <p className="text-xs text-[#8a8886]">ID: {user.id}</p>
                    {user.provider_tier ? <p className="text-xs text-[#605E5C]">tier: {user.provider_tier}</p> : null}
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
                      className={inputClass}
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
                        className={inputClass}
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

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteUser(user)
                      }}
                      className={secondaryButtonClass}
                    >
                      Delete
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmTempPasswordUser(user)
                      }}
                      className={secondaryButtonClass}
                    >
                      Temp password
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmResetLinkUser(user)
                      }}
                      className={secondaryButtonClass}
                    >
                      Reset link
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfirmCopyResetLinkUser(user)
                      }}
                      className={secondaryButtonClass}
                    >
                      Copy reset link
                    </button>

                    <button
                      type="button"
                      disabled={relationsLoading && relationsUserId === user.id}
                      onClick={() => {
                        setRelationsLoading(true)
                        setRelationsUserId(user.id)
                        void getUserProviderRelations(user.id)
                          .then((data) => {
                            setRelationsData(data)
                            setRelationsSearch('')
                            setStatus('User-provider relations loaded')
                          })
                          .catch((error) => setStatus(error instanceof Error ? error.message : 'Failed to load relations'))
                          .finally(() => setRelationsLoading(false))
                      }}
                      className={secondaryButtonClass}
                    >
                      {relationsLoading && relationsUserId === user.id ? 'Loading…' : 'Relations'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {confirmDeleteUser ? (
            <ActionModal
              title="Delete user"
              message={`Delete user ${confirmDeleteUser.email || confirmDeleteUser.id}? This cannot be undone.`}
              confirmLabel="Delete"
              onCancel={() => setConfirmDeleteUser(null)}
              onConfirm={() => {
                const selectedUser = confirmDeleteUser
                setConfirmDeleteUser(null)
                void handleDeleteUser(selectedUser).catch((error) =>
                  setStatus(error instanceof Error ? error.message : 'User deletion failed'),
                )
              }}
              danger
            />
          ) : null}

          {confirmTempPasswordUser ? (
            <ActionModal
              title="Generate temporary password"
              message={`Generate temporary password for ${confirmTempPasswordUser.email || confirmTempPasswordUser.id}? User will be forced to change it at first login.`}
              confirmLabel="Generate"
              onCancel={() => setConfirmTempPasswordUser(null)}
              onConfirm={() => {
                const selectedUser = confirmTempPasswordUser
                setConfirmTempPasswordUser(null)
                void handleGenerateTempPassword(selectedUser).catch((error) =>
                  setStatus(error instanceof Error ? error.message : 'Temporary password generation failed'),
                )
              }}
            />
          ) : null}

          {confirmResetLinkUser ? (
            <ActionModal
              title="Generate reset link"
              message={`Generate reset password link for ${confirmResetLinkUser.email || confirmResetLinkUser.id}? This returns a reset link, not a temporary password.`}
              confirmLabel="Generate link"
              onCancel={() => setConfirmResetLinkUser(null)}
              onConfirm={() => {
                const selectedUser = confirmResetLinkUser
                setConfirmResetLinkUser(null)
                void handleGenerateResetLink(selectedUser).catch((error) =>
                  setStatus(error instanceof Error ? error.message : 'Password reset failed'),
                )
              }}
            />
          ) : null}

          {confirmCopyResetLinkUser ? (
            <ActionModal
              title="Copy reset link"
              message={`Generate and copy reset password link for ${confirmCopyResetLinkUser.email || confirmCopyResetLinkUser.id}?`}
              confirmLabel="Generate and copy"
              onCancel={() => setConfirmCopyResetLinkUser(null)}
              onConfirm={() => {
                const selectedUser = confirmCopyResetLinkUser
                setConfirmCopyResetLinkUser(null)
                void handleCopyResetLink(selectedUser).catch((error) =>
                  setStatus(error instanceof Error ? error.message : 'Password reset copy failed'),
                )
              }}
            />
          ) : null}

          {tempPasswordModal ? (
            <TempPasswordModal
              userLabel={tempPasswordModal.userLabel}
              password={tempPasswordModal.password}
              onClose={() => setTempPasswordModal(null)}
            />
          ) : null}

          {generatedTempPassword ? (
            <div className="rounded border border-[#edebe9] bg-[#faf9f8] p-2 text-xs text-[#323130]">
              <p className="font-semibold text-[#323130]">Temporary password (one-time display)</p>
              <p className="mt-1 text-[#605E5C]">User: {generatedTempPasswordUser}</p>
              <p className="mt-1 break-all text-[#605E5C]">{generatedTempPassword}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'api' ? (
        <div className="space-y-2">
          <div className={panelClass}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605E5C]">Partner onboarding</p>

            <div className="grid gap-2 md:grid-cols-3">
              <input
                value={partnerCode}
                onChange={(event) => setPartnerCode(event.target.value.toUpperCase())}
                placeholder="Code partenaire"
                className={inputClass}
              />
              <input
                value={partnerName}
                onChange={(event) => setPartnerName(event.target.value)}
                placeholder="Nom partenaire"
                className={inputClass}
              />
              <select
                value={partnerStatus}
                onChange={(event) =>
                  setPartnerStatus(event.target.value as 'draft' | 'sandbox_active' | 'production_active' | 'suspended')
                }
                className={inputClass}
              >
                <option value="draft">draft</option>
                <option value="sandbox_active">sandbox_active</option>
                <option value="production_active">production_active</option>
                <option value="suspended">suspended</option>
              </select>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  void upsertPartner({
                    code: partnerCode,
                    name: partnerName,
                    status: partnerStatus,
                  })
                    .then((partner) => {
                      setStatus(partner ? `Partner ${partner.code} saved` : 'Partner saved')
                      setGeneratedPartnerKey('')
                      setPartnerCode('')
                      setPartnerName('')
                      setPartnerStatus('draft')
                      return loadAll()
                    })
                    .catch((error) => setStatus(error instanceof Error ? error.message : 'Partner save failed'))
                }}
                className={primaryButtonClass}
              >
                Save partner
              </button>
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-4">
              <select
                value={selectedPartnerId}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className={inputClass}
              >
                <option value="">Select partner</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.code} - {partner.name}
                  </option>
                ))}
              </select>

              <select
                value={partnerKeyEnv}
                onChange={(event) => setPartnerKeyEnv(event.target.value as 'sandbox' | 'production')}
                className={inputClass}
              >
                <option value="sandbox">sandbox</option>
                <option value="production">production</option>
              </select>

              <input
                value={partnerScopes}
                onChange={(event) => setPartnerScopes(event.target.value)}
                placeholder="Scopes (comma separated)"
                className={inputClass}
              />

              <button
                type="button"
                disabled={!selectedPartnerId || generatingPartnerKey}
                onClick={() => {
                  setGeneratingPartnerKey(true)
                  const scopes = partnerScopes
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)

                  void generatePartnerKey({
                    partner_id: selectedPartnerId,
                    environment: partnerKeyEnv,
                    scopes,
                  })
                    .then((result) => {
                      setGeneratedPartnerKey(result.key)
                      setStatus('Partner API key generated (visible once)')
                      return loadAll()
                    })
                    .catch((error) => setStatus(error instanceof Error ? error.message : 'Partner key generation failed'))
                    .finally(() => setGeneratingPartnerKey(false))
                }}
                className={primaryButtonClass}
              >
                {generatingPartnerKey ? 'Generating…' : 'Generate key'}
              </button>
            </div>

            {generatedPartnerKey ? (
              <div className="mt-2 rounded border border-[#edebe9] bg-[#faf9f8] p-2 text-xs text-[#323130]">
                <p className="font-semibold text-[#323130]">Copy now (one-time display)</p>
                <p className="mt-1 break-all text-[#605E5C]">{generatedPartnerKey}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
              <span>Partner</span>
              <span>Status</span>
              <span>Credentials</span>
              <span>Created</span>
            </div>

            {partners.map((partner) => (
              <article key={partner.id} className={rowClass}>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center">
                  <div>
                    <p className="font-semibold text-[#323130]">{partner.code}</p>
                    <p className="text-[#605E5C]">{partner.name}</p>
                  </div>
                  <p className="text-[#323130]">{partner.status}</p>
                  <p className="text-[#605E5C]">
                    active {partner.active_credentials_count} / total {partner.credentials_count}
                  </p>
                  <p className="text-[#605E5C]">{new Date(partner.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={panelClass}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605E5C]">Production access requests</p>
            {partnerAccessRequests.length === 0 ? (
              <p className="text-xs text-[#605E5C]">No pending requests</p>
            ) : (
              <div className="space-y-2">
                {partnerAccessRequests.map((request) => (
                  <article key={request.id} className={rowClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[#323130]">{request.partner_code} - {request.partner_name}</p>
                        <p className="text-[#605E5C]">{new Date(request.created_at).toLocaleString('fr-FR')}</p>
                        {request.notes ? <p className="text-[#605E5C]">{request.notes}</p> : null}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void reviewPartnerAccessRequest({ request_id: request.id, decision: 'approved' })
                              .then(() => {
                                setStatus('Production access approved')
                                return loadAll()
                              })
                              .catch((error) => setStatus(error instanceof Error ? error.message : 'Approval failed'))
                          }}
                          className={primaryButtonClass}
                        >
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            void reviewPartnerAccessRequest({ request_id: request.id, decision: 'rejected' })
                              .then(() => {
                                setStatus('Production access rejected')
                                return loadAll()
                              })
                              .catch((error) => setStatus(error instanceof Error ? error.message : 'Rejection failed'))
                          }}
                          className={secondaryButtonClass}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#605E5C]">Error rate: {apiErrorRate.toFixed(1)}%</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  exportCsv(transferApiCalls as unknown as Record<string, unknown>[], 'admin-transfer-api-usage.csv')
                }
                className={secondaryButtonClass}
              >
                Export transfer calls
              </button>
              <button
                type="button"
                onClick={() =>
                  exportCsv(partnerTransfers as unknown as Record<string, unknown>[], 'admin-partner-transfers.csv')
                }
                className={secondaryButtonClass}
              >
                Export transfers
              </button>
              <button
                type="button"
                onClick={() => exportCsv(apiUsage as unknown as Record<string, unknown>[], 'admin-api-usage.csv')}
                className={secondaryButtonClass}
              >
                Export all API ops
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card label="Transfer API calls" value={String(transferApiCalls.length)} />
            <Card label="Partner transfers" value={String(partnerTransfers.length)} />
            <Card
              label="Failed partner transfers"
              value={String(partnerTransfers.filter((row) => row.status !== 'accepted').length)}
            />
          </div>

          <div className={panelClass}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605E5C]">Partner transfer history</p>
            <div className="mb-2 grid gap-2 md:grid-cols-3">
              <input
                value={transferSearch}
                onChange={(event) => setTransferSearch(event.target.value)}
                placeholder="Search by external user, tx ref, partner, Looyaal user"
                className={inputClass}
              />
              <select
                value={transferStatusFilter}
                onChange={(event) =>
                  setTransferStatusFilter(event.target.value as 'all' | 'accepted' | 'rejected' | 'pending')
                }
                className={inputClass}
              >
                <option value="all">all statuses</option>
                <option value="accepted">accepted</option>
                <option value="rejected">rejected</option>
                <option value="pending">pending</option>
              </select>
              <div className="rounded border border-[#edebe9] bg-[#faf9f8] px-2 py-1.5 text-xs text-[#605E5C]">
                Displaying {filteredPartnerTransfers.length} / {partnerTransfers.length}
              </div>
            </div>

            <div className="max-h-[420px] space-y-2 overflow-auto">
              {filteredPartnerTransfers.length === 0 ? (
                <p className="text-xs text-[#605E5C]">No transfer history found for this filter.</p>
              ) : (
                filteredPartnerTransfers.map((row) => (
                  <article key={row.id} className={rowClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[#323130]">
                        {row.direction} {row.points_delta} pts • {row.transaction_ref}
                      </p>
                      <p className={row.status === 'accepted' ? 'text-[#0078D4]' : 'text-[#a4262c]'}>{row.status}</p>
                    </div>
                    <p className="text-[#605E5C]">
                      ext: {row.external_user_id} • Looyaal: {row.loyalup_user_id ?? '-'} • email: {row.loyalup_user_email ?? '-'} • partner: {row.partner_id}
                    </p>
                    <p className="text-[#605E5C]">
                      balance: {row.resulting_balance ?? '-'} • {new Date(row.created_at).toLocaleString('fr-FR')}
                      {row.error_code ? ` • error: ${row.error_code}` : ''}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className={panelClass}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#605E5C]">Transfer API call history</p>

            <div className="max-h-[360px] space-y-2 overflow-auto">
              {transferApiCalls.length === 0 ? (
                <p className="text-xs text-[#605E5C]">No transfer API calls recorded.</p>
              ) : (
                transferApiCalls.map((row) => (
                  <article key={row.id} className={rowClass}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[#323130]">{row.method} {row.endpoint}</p>
                      <p className={(row.status_code ?? 200) >= 400 ? 'text-[#a4262c]' : 'text-[#0078D4]'}>
                        {row.status_code ?? '-'}
                      </p>
                    </div>
                    <p className="text-[#605E5C]">
                      {new Date(row.created_at).toLocaleString('fr-FR')} • {row.response_time_ms ?? 0} ms • {row.ip_address ?? '-'}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-[2fr_1fr_3fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
            <span>Endpoint</span>
            <span>Status</span>
            <span>Metadata</span>
          </div>

          {apiUsage.slice(0, 50).map((row) => (
            <article key={row.id} className={rowClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[#323130]">{row.method} {row.endpoint}</p>
                <p className={(row.status_code ?? 200) >= 400 ? 'text-[#a4262c]' : 'text-[#0078D4]'}>{row.status_code ?? '-'}</p>
              </div>
              <p className="text-[#605E5C]">{new Date(row.created_at).toLocaleString('fr-FR')} • {row.response_time_ms ?? 0} ms • {row.ip_address ?? '-'}</p>
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

          <div className="grid grid-cols-[2fr_1fr_2fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
            <span>Event</span>
            <span>Action</span>
            <span>Delivery</span>
          </div>

          {webhookFailures.slice(0, 50).map((row) => (
            <article key={row.id} className={rowClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[#323130]">{row.event_type}</p>
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
              <p className="text-[#605E5C]">status: {row.response_status ?? '-'} • attempts: {row.attempt_number} • {new Date(row.delivered_at).toLocaleString('fr-FR')}</p>
              <p className="mt-1 line-clamp-2 text-[#605E5C]">{row.response_body ?? ''}</p>
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

          <div className="grid grid-cols-[2fr_1fr_2fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
            <span>Action</span>
            <span>Date</span>
            <span>Context</span>
          </div>

          {auditLogs.slice(0, 80).map((log) => (
            <article key={log.id} className={rowClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={log.success ? 'text-[#0078D4]' : 'text-[#a4262c]'}>{log.action}</p>
                <p className="text-[#605E5C]">{new Date(log.created_at).toLocaleString('fr-FR')}</p>
              </div>
              <p className="text-[#605E5C]">admin: {log.admin_user_id} {log.target_user_id ? `• target: ${log.target_user_id}` : ''}</p>
              <p className="mt-1 line-clamp-2 text-[#605E5C]">{JSON.stringify(log.metadata ?? {})}</p>
            </article>
          ))}
        </div>
      ) : null}

      {activeTab === 'ads' ? (
        <ScanAdsManager onStatusChange={setStatus} />
      ) : null}

      {activeTab === 'institutions' ? (
        <InstitutionAccessManager />
      ) : null}

      {status ? <p className="text-xs text-[#605E5C]">{status}</p> : null}
    </div>
  )
}

function Card(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#edebe9] bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#605E5C]">{props.label}</p>
      <p className="mt-1 text-[28px] font-bold text-[#323130]">{props.value}</p>
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

type ActionModalProps = {
  title: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
  danger?: boolean
}

function ActionModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
  danger = false,
}: ActionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-md border border-[#edebe9] bg-white p-4 shadow-xl">
        <p className="text-base font-semibold text-[#323130]">{title}</p>
        <p className="mt-2 text-sm text-[#605E5C]">{message}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded border border-[#d2d0ce] bg-white px-3 text-xs font-semibold text-[#323130] transition hover:bg-[#f3f2f1]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`h-8 rounded px-3 text-xs font-semibold text-white transition ${
              danger ? 'bg-[#a4262c] hover:bg-[#7f1d22]' : 'bg-[#0078D4] hover:bg-[#106ebe]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

type TempPasswordModalProps = {
  userLabel: string
  password: string
  onClose: () => void
}

function TempPasswordModal({ userLabel, password, onClose }: TempPasswordModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-md border border-[#edebe9] bg-white p-4 shadow-xl">
        <p className="text-base font-semibold text-[#323130]">Temporary password generated</p>
        <p className="mt-2 text-sm text-[#605E5C]">User: {userLabel}</p>
        <p className="mt-3 break-all rounded border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-sm font-semibold text-[#323130]">
          {password}
        </p>
        <p className="mt-2 text-xs text-[#605E5C]">Copy it now and share it securely.</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard?.writeText) {
                void navigator.clipboard.writeText(password)
              }
            }}
            className="h-8 rounded border border-[#0078D4] bg-white px-3 text-xs font-semibold text-[#0078D4] transition hover:bg-[#f3f2f1]"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
