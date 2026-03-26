import { useMarketplaceInsights } from '../../hooks/useMarketplaceInsights'

type MerchantPerformanceRankCardProps = {
  merchantId: string
}

export function MerchantPerformanceRankCard({ merchantId }: MerchantPerformanceRankCardProps) {
  const { merchantRanking, loading, error } = useMarketplaceInsights(merchantId)

  return (
    <section className="rounded-[16px] border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Classement annuaire</p>
          <h2 className="mt-1 font-display text-2xl font-extrabold text-dark">Performance marketplace</h2>
        </div>

        {merchantRanking ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-right">
            <p className="font-body text-xs uppercase tracking-[0.12em] text-gray-500">Position</p>
            <p className="mt-1 font-display text-xl font-extrabold text-dark">#{merchantRanking.rank} / {merchantRanking.total}</p>
            <p className="font-body text-xs text-gray-500">Score: {merchantRanking.score}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 space-y-2">
        {merchantRanking?.tips.map((tip, index) => (
          <p key={`${index}-${tip}`} className="rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2 font-body text-sm text-gray-700">
            {tip}
          </p>
        ))}
      </div>

      {loading ? <p className="pt-3 font-body text-xs text-gray-500">Calcul du classement...</p> : null}
      {!loading && !merchantRanking ? <p className="pt-3 font-body text-sm text-gray-500">Classement indisponible pour le moment.</p> : null}
      {error ? <p className="pt-3 font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
