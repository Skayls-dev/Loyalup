import { useEffect, useState, type CSSProperties } from 'react'

type WidgetData = {
  provider: {
    id: string
    name: string
  }
  branding: {
    logo_url: string | null
    primary_color: string
    secondary_color: string
    accent_color: string
    show_loyalup_branding: boolean
  }
  promotions: Array<{
    id: string
    titre: string
    description: string
    points_requis: number
  }>
}

export function Widget(props: { fournisseurId: string; baseUrl: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<WidgetData | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await fetch(
          `${props.baseUrl}/functions/v1/widget-public?fournisseur_id=${encodeURIComponent(props.fournisseurId)}`,
        )

        const body = (await response.json()) as { error?: string; widget?: WidgetData }
        if (!response.ok) {
          throw new Error(body.error ?? 'Widget request failed')
        }

        if (!body.widget) {
          throw new Error('Invalid widget payload')
        }

        setData(body.widget)
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : 'Failed to load widget')
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [props.baseUrl, props.fournisseurId])

  if (loading) {
    return <div style={baseContainerStyle}>Chargement du widget...</div>
  }

  if (error || !data) {
    return <div style={baseContainerStyle}>Erreur: {error || 'Invalid data'}</div>
  }

  return (
    <div
      style={{
        ...baseContainerStyle,
        background: data.branding.primary_color,
        color: data.branding.accent_color,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {data.branding.logo_url ? (
            <img src={data.branding.logo_url} alt={data.provider.name} style={{ height: 28, width: 28, borderRadius: 6 }} />
          ) : null}
          <strong>{data.provider.name}</strong>
        </div>
        {data.branding.show_loyalup_branding ? <span style={{ fontSize: 11, opacity: 0.7 }}>Powered by LoyalUp</span> : null}
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        {data.promotions.length === 0 ? <p style={{ margin: 0, fontSize: 12 }}>Aucune promotion active</p> : null}
        {data.promotions.map((promo) => (
          <article
            key={promo.id}
            style={{
              border: `1px solid ${data.branding.secondary_color}`,
              borderRadius: 10,
              padding: 10,
              background: 'rgba(0, 0, 0, 0.15)',
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{promo.titre}</p>
            <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>{promo.description}</p>
            <p style={{ margin: '6px 0 0', fontSize: 11, opacity: 0.7 }}>{promo.points_requis} pts</p>
          </article>
        ))}
      </div>
    </div>
  )
}

const baseContainerStyle: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  borderRadius: 12,
  padding: 14,
  minWidth: 280,
  maxWidth: 360,
  boxSizing: 'border-box',
}
