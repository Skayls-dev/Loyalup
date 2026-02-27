import { useMemo } from 'react'
import type { NetworkMember } from '../../types/networkTypes'

type NetworkMembersMapProps = {
  members: NetworkMember[]
}

type GeoPoint = {
  id: string
  city: string
  provider_name: string
  x: number
  y: number
  client_count: number
}

export function NetworkMembersMap({ members }: NetworkMembersMapProps) {
  const { points, missingGeoMembers } = useMemo(() => {
    const withGeo = members.filter(
      (member) =>
        typeof member.latitude === 'number' &&
        typeof member.longitude === 'number' &&
        Number.isFinite(member.latitude) &&
        Number.isFinite(member.longitude),
    )

    const missing = members.filter(
      (member) =>
        typeof member.latitude !== 'number' ||
        typeof member.longitude !== 'number' ||
        !Number.isFinite(member.latitude) ||
        !Number.isFinite(member.longitude),
    )

    if (withGeo.length === 0) {
      return { points: [] as GeoPoint[], missingGeoMembers: missing }
    }

    const lats = withGeo.map((member) => Number(member.latitude))
    const lngs = withGeo.map((member) => Number(member.longitude))
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)

    const latSpan = Math.max(0.01, maxLat - minLat)
    const lngSpan = Math.max(0.01, maxLng - minLng)

    const projected = withGeo.map((member) => {
      const lat = Number(member.latitude)
      const lng = Number(member.longitude)
      const x = 8 + ((lng - minLng) / lngSpan) * 84
      const y = 8 + (1 - (lat - minLat) / latSpan) * 84

      return {
        id: member.fournisseur_id,
        city: member.city?.trim() || 'Ville inconnue',
        provider_name: member.provider_name,
        x,
        y,
        client_count: Number(member.client_count ?? 0),
      }
    })

    return { points: projected, missingGeoMembers: missing }
  }, [members])

  if (points.length === 0) {
    return <p className="text-xs text-zinc-400">Aucune coordonnée GPS disponible pour afficher la carte.</p>
  }

  return (
    <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
      <p className="text-xs text-zinc-400">Carte des membres (géolocalisée)</p>
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <svg viewBox="0 0 100 100" className="h-48 w-full">
          <rect x="0" y="0" width="100" height="100" fill="#18181b" />
          <rect x="8" y="8" width="84" height="84" rx="10" fill="#27272a" />
          {points.map((point) => (
            <g key={point.id}>
              <circle cx={point.x} cy={point.y} r={Math.max(2.2, Math.min(5.5, 2 + point.client_count * 0.08))} fill="#818cf8" opacity="0.75" />
              <circle cx={point.x} cy={point.y} r={1.2} fill="#e0e7ff" />
              <title>{`${point.provider_name} · ${point.city}`}</title>
            </g>
          ))}
        </svg>
      </div>

      <div className="max-h-28 space-y-1 overflow-y-auto pr-1 text-xs">
        {points
          .sort((left, right) => right.client_count - left.client_count)
          .map((point) => (
            <div key={point.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-2 py-1">
              <span className="text-zinc-200">{point.provider_name} · {point.city}</span>
              <span className="text-zinc-400">{point.client_count} clients</span>
            </div>
          ))}
      </div>

      {missingGeoMembers.length > 0 ? (
        <p className="text-[11px] text-zinc-500">
          {missingGeoMembers.length} commerce(s) sans coordonnées GPS (latitude/longitude).
        </p>
      ) : null}
    </section>
  )
}
