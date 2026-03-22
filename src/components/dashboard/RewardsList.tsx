import { RewardList } from '../../modules/loyalty/components/RewardList'

export interface RewardsListProps {
  className?: string
}

export function RewardsList({ className = '' }: RewardsListProps) {

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-4 ${className}`}>
      <p className="mb-3 font-body text-xs uppercase tracking-[0.16em] text-gray-500">Récompenses disponibles</p>

      <RewardList />
    </section>
  )
}
