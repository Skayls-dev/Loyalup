import { PromoList } from '../../modules/promotions/components/PromoList'
import { PageHeader } from '../../shared/components/client-ui'

export function ClientPromotions() {
  return (
    <section className="space-y-4">
      <PageHeader title="Promotions" subtitle="Offres actives dans vos programmes fidélité" />
      <PromoList />
    </section>
  )
}
