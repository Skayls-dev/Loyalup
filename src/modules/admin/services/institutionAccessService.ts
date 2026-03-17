import { supabase } from '../../../shared/lib/supabaseClient'

export interface InstitutionProfile {
  id: string
  nom: string
  email: string
  created_at: string
}

export interface InstitutionNetworkLink {
  id: string
  institution_id: string
  institution_name: string
  network_id: string
  network_slug: string
  network_name: string
  granted_at: string
}

export interface NetworkOption {
  id: string
  slug: string
  name: Record<string, string> | null
}

export async function listInstitutions(): Promise<InstitutionProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nom, email, created_at')
    .eq('role', 'institution')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listAvailableNetworks(): Promise<NetworkOption[]> {
  const { data, error } = await supabase
    .from('networks')
    .select('id, slug, name')
    .eq('is_active', true)
    .order('slug', { ascending: true })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listInstitutionNetworkLinks(): Promise<InstitutionNetworkLink[]> {
  const { data, error } = await supabase
    .from('institution_network_access')
    .select(`
      id,
      profile_id,
      network_id,
      granted_at,
      profiles!profile_id(nom, email),
      networks!network_id(slug, name)
    `)
    .order('granted_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    institution_id: row.profile_id,
    institution_name: row.profiles?.nom ?? 'Unknown',
    network_id: row.network_id,
    network_slug: row.networks?.slug ?? 'unknown',
    network_name: typeof row.networks?.name === 'object' && row.networks?.name ? 
      (row.networks.name.fr || row.networks.name.en || row.networks.slug) : 
      row.networks?.slug ?? 'unknown',
    granted_at: row.granted_at,
  }))
}

export async function grantInstitutionAccess(
  profile_id: string,
  network_id: string,
  granted_by_admin_id: string,
): Promise<void> {
  // First check if access already exists
  const { data: existing } = await supabase
    .from('institution_network_access')
    .select('id')
    .eq('profile_id', profile_id)
    .eq('network_id', network_id)
    .maybeSingle()

  if (existing) {
    throw new Error('Institution already has access to this network')
  }

  // Create the access record
  const { error } = await supabase
    .from('institution_network_access')
    .insert({
      profile_id,
      network_id,
      granted_by: granted_by_admin_id,
    })

  if (error) throw new Error(error.message)
}

export async function revokeInstitutionAccess(access_id: string): Promise<void> {
  const { error } = await supabase
    .from('institution_network_access')
    .delete()
    .eq('id', access_id)

  if (error) throw new Error(error.message)
}
