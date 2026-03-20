import { Globe } from 'lucide-react'
import { NetworkDiscovery } from '../../modules/networks/components/client/NetworkDiscovery'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientNetworksPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Mes réseaux"
        subtitle="Rejoignez de nouveaux réseaux, suivez vos adhésions actives et découvrez les avantages multi-commerces."
        rightActions={<Badge variant="success">Exploration</Badge>}
      />

      <SectionCard className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Globe className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Découvrir et gérer</h2>
            <p className="text-sm text-slate-500">Consultez les réseaux recommandés et pilotez vos inscriptions depuis un seul écran.</p>
          </div>
        </div>

        <NetworkDiscovery />
      </SectionCard>
    </section>
  )
}
