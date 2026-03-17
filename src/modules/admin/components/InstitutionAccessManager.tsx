import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import {
  grantInstitutionAccess,
  listAvailableNetworks,
  listInstitutionNetworkLinks,
  listInstitutions,
  revokeInstitutionAccess,
  type InstitutionNetworkLink,
  type InstitutionProfile,
  type NetworkOption,
} from '../services/institutionAccessService'

const inputClass = 'h-8 rounded border border-[#d2d0ce] bg-white px-2 text-xs text-[#323130] placeholder:text-[#8a8886]'
const primaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-60'
const dangerButtonClass =
  'h-7 rounded border border-[#A4262C] bg-white px-2 text-xs font-semibold text-[#A4262C] transition hover:bg-[#FDF0F0] disabled:opacity-60'
const panelClass = 'rounded-md border border-[#edebe9] bg-white p-4 shadow-sm'
const rowClass = 'rounded-md border border-[#edebe9] bg-white p-3 text-xs text-[#323130] transition hover:bg-[#f3f2f1]'

export function InstitutionAccessManager() {
  const { user } = useAuth()
  const [institutions, setInstitutions] = useState<InstitutionProfile[]>([])
  const [networks, setNetworks] = useState<NetworkOption[]>([])
  const [links, setLinks] = useState<InstitutionNetworkLink[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [selectedInstitutionId, setSelectedInstitutionId] = useState('')
  const [selectedNetworkId, setSelectedNetworkId] = useState('')
  const [granting, setGranting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [inst, nets, lnks] = await Promise.all([listInstitutions(), listAvailableNetworks(), listInstitutionNetworkLinks()])
      setInstitutions(inst)
      setNetworks(nets)
      setLinks(lnks)
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleGrant = async () => {
    if (!selectedInstitutionId || !selectedNetworkId || !user?.id) return
    setGranting(true)
    setStatus('')
    try {
      await grantInstitutionAccess(selectedInstitutionId, selectedNetworkId, user.id)
      setStatus('Accès accordé avec succès')
      setSelectedInstitutionId('')
      setSelectedNetworkId('')
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur de création de liaison')
    } finally {
      setGranting(false)
    }
  }

  const handleRevoke = async (accessId: string) => {
    setStatus('')
    try {
      await revokeInstitutionAccess(accessId)
      setStatus('Accès révoqué')
      await loadAll()
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Erreur de révocation')
    }
  }

  return (
    <div className="space-y-4">
      {/* Status message */}
      {status ? (
        <p className="rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-xs text-[#323130]">{status}</p>
      ) : null}

      {/* Grant access panel */}
      <div className={panelClass}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#605E5C]">
          Accorder un accès réseau à une institution
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#605E5C]">Institution</label>
            <select
              value={selectedInstitutionId}
              onChange={(event) => setSelectedInstitutionId(event.target.value)}
              className={inputClass}
            >
              <option value="">Sélectionner une institution</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.nom} ({inst.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[#605E5C]">Réseau</label>
            <select
              value={selectedNetworkId}
              onChange={(event) => setSelectedNetworkId(event.target.value)}
              className={inputClass}
            >
              <option value="">Sélectionner un réseau</option>
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {typeof network.name === 'object' && network.name
                    ? (network.name.fr || network.name.en || network.slug)
                    : network.slug}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            disabled={!selectedInstitutionId || !selectedNetworkId || granting}
            onClick={() => { void handleGrant() }}
            className={primaryButtonClass}
          >
            {granting ? 'En cours…' : 'Accorder l\'accès'}
          </button>
        </div>

        {institutions.length === 0 && !loading ? (
          <p className="mt-2 text-xs text-[#605E5C]">
            Aucun compte institution trouvé. Créez un compte avec le rôle &quot;institution&quot; dans la gestion des utilisateurs.
          </p>
        ) : null}
      </div>

      {/* Active links */}
      <div className="space-y-2">
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-2 rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#605E5C]">
          <span>Institution</span>
          <span>Réseau</span>
          <span>Accordé le</span>
          <span>Actions</span>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse rounded-md border border-[#edebe9] bg-[#faf9f8]" />
        ) : links.length === 0 ? (
          <p className="rounded-md border border-[#edebe9] bg-[#faf9f8] px-3 py-4 text-center text-xs text-[#605E5C]">
            Aucune liaison institution ↔ réseau configurée
          </p>
        ) : (
          links.map((link) => (
            <article key={link.id} className={rowClass}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_2fr_1fr_1fr] md:items-center">
                <div>
                  <p className="font-semibold text-[#323130]">{link.institution_name}</p>
                  <p className="text-[#605E5C]">{link.institution_id.slice(0, 8)}…</p>
                </div>
                <div>
                  <p className="font-semibold text-[#323130]">{link.network_name}</p>
                  <p className="text-[#605E5C]">{link.network_slug}</p>
                </div>
                <p className="text-[#605E5C]">
                  {new Date(link.granted_at).toLocaleDateString('fr-FR')}
                </p>
                <button
                  type="button"
                  onClick={() => { void handleRevoke(link.id) }}
                  className={dangerButtonClass}
                >
                  Révoquer
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
