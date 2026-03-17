import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../shared/lib/supabaseClient'
import type { Network } from '../types/networkTypes'

type InstitutionProfile = {
  id: string
  nom: string
  email: string
}

type InstitutionAccess = {
  id: string
  profile_id: string
  network_id: string
  granted_at: string
  profile?: {
    nom: string
    email: string
  }
  network?: {
    slug: string
    name: Record<string, string> | null
  }
}

type InstitutionAccessManagerProps = {
  networks: Network[]
}

const inputClass =
  'h-8 rounded border border-[#d2d0ce] bg-white px-2 text-xs text-[#323130] outline-none focus:border-[#0078D4]'
const selectClass = inputClass
const primaryButtonClass =
  'h-8 rounded border border-[#0078D4] bg-[#0078D4] px-3 text-xs font-semibold text-white transition hover:bg-[#106ebe] disabled:opacity-60'
const dangerButtonClass =
  'h-8 rounded border border-[#d13438] bg-white px-3 text-xs font-semibold text-[#d13438] transition hover:bg-[#fdf3f4] disabled:opacity-60'
const sectionCardClass = 'rounded-md border border-[#edebe9] bg-white p-4 shadow-sm'

export function InstitutionAccessManager({ networks }: InstitutionAccessManagerProps) {
  const [institutionProfiles, setInstitutionProfiles] = useState<InstitutionProfile[]>([])
  const [institutionAccess, setInstitutionAccess] = useState<InstitutionAccess[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [selectedNetworkId, setSelectedNetworkId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch institution profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nom, email')
        .eq('role', 'institution')

      if (profilesError) {
        throw profilesError
      }

      setInstitutionProfiles((profiles ?? []) as InstitutionProfile[])

      // Fetch institution access with joins
      const { data: access, error: accessError } = await supabase
        .from('institution_network_access')
        .select('id, profile_id, network_id, granted_at, profiles!inner(nom, email), networks!inner(slug, name)')

      if (accessError) {
        throw accessError
      }

      setInstitutionAccess(
        (access ?? []).map((row) => ({
          id: row.id,
          profile_id: row.profile_id,
          network_id: row.network_id,
          granted_at: row.granted_at,
          profile: row.profiles,
          network: row.networks,
        } as InstitutionAccess)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData().catch(() => null)
  }, [])

  const handleAddAccess = async () => {
    if (!selectedProfileId || !selectedNetworkId) {
      setError('Sélectionnez un profil institution et un réseau')
      return
    }

    try {
      setError(null)
      setSuccessMessage(null)

      const { error: insertError } = await supabase
        .from('institution_network_access')
        .insert({
          profile_id: selectedProfileId,
          network_id: selectedNetworkId,
        })

      if (insertError) {
        if (insertError.code === '23505') {
          throw new Error('Cet accès existe déjà')
        }
        throw insertError
      }

      setSuccessMessage('Accès accordé avec succès')
      setSelectedProfileId('')
      setSelectedNetworkId('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création')
    }
  }

  const handleRevokeAccess = async (accessId: string) => {
    try {
      setError(null)
      const { error: deleteError } = await supabase
        .from('institution_network_access')
        .delete()
        .eq('id', accessId)

      if (deleteError) {
        throw deleteError
      }

      setSuccessMessage('Accès révoqué avec succès')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la révocation')
    }
  }

  const networkMap = useMemo(() => {
    const map = new Map<string, Network>()
    for (const network of networks) {
      map.set(network.id, network)
    }
    return map
  }, [networks])

  const accessGroupedByProfile = useMemo(() => {
    const groups = new Map<string, InstitutionAccess[]>()
    for (const access of institutionAccess) {
      const key = access.profile_id
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(access)
    }
    return groups
  }, [institutionAccess])

  return (
    <section className={sectionCardClass}>
      <h2 className="mb-4 text-[17px] font-semibold text-[#323130]">Accès institutionnels</h2>

      {error && (
        <div className="mb-3 rounded-md border border-[#d13438] bg-[#fdf3f4] px-3 py-2 text-xs text-[#d13438]">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-3 rounded-md border border-[#107c10] bg-[#f1f1f1] px-3 py-2 text-xs text-[#107c10]">
          {successMessage}
        </div>
      )}

      {/* Add new access */}
      <div className="mb-4 flex flex-wrap gap-2 rounded-md border border-[#d2d0ce] bg-[#faf9f8] p-3">
        <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className={selectClass}>
          <option value="">Sélectionner un profil institution...</option>
          {institutionProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.nom} ({profile.email})
            </option>
          ))}
        </select>

        <select value={selectedNetworkId} onChange={(e) => setSelectedNetworkId(e.target.value)} className={selectClass}>
          <option value="">Sélectionner un réseau...</option>
          {networks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.emoji} {network.name?.fr ?? network.name?.en ?? network.slug}
            </option>
          ))}
        </select>

        <button type="button" onClick={handleAddAccess} disabled={loading} className={primaryButtonClass}>
          Ajouter accès
        </button>
      </div>

      {/* List of access by profile */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-[#faf9f8]" />
          ))}
        </div>
      ) : institutionAccess.length === 0 ? (
        <p className="text-xs text-[#605E5C]">Aucun accès institutionnel configuré</p>
      ) : (
        <div className="space-y-3">
          {Array.from(accessGroupedByProfile.values()).map((accesses) => {
            const profileName = accesses[0]?.profile?.nom
            const profileEmail = accesses[0]?.profile?.email
            return (
              <div key={profileName} className="rounded-md border border-[#edebe9] bg-[#faf9f8] p-3">
                <p className="mb-2 font-semibold text-[#323130]">
                  {profileName} ({profileEmail})
                </p>
                <div className="space-y-1">
                  {accesses.map((access) => {
                    const network = networkMap.get(access.network_id)
                    const networkName = network
                      ? `${network.emoji} ${network.name?.fr ?? network.name?.en ?? network.slug}`
                      : 'Réseau supprimé'
                    return (
                      <div
                        key={access.id}
                        className="flex items-center justify-between rounded-md border border-[#d2d0ce] bg-white px-2 py-2 text-xs"
                      >
                        <span className="text-[#323130]">{networkName}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[#605E5C]">
                            {new Date(access.granted_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleRevokeAccess(access.id)}
                            className={dangerButtonClass}
                          >
                            Révoquer
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
