import { GamificationWidget } from '../../modules/gamification'
import { PageHeader } from '../../shared/components/client-ui'

export function ClientGamification() {
  return (
    <section className="space-y-4">
      <PageHeader title="Défis & progression" subtitle="Suivez votre niveau, badges et séries" />
      <GamificationWidget layout="full" language="fr" />
    </section>
  )
}
