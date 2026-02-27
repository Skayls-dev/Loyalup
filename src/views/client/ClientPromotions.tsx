import { PromoList } from '../../modules/promotions/components/PromoList'

export function ClientPromotions() {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-zinc-100">Promotions</h1>
      </header>
      <PromoList />
    </section>
  )
}
