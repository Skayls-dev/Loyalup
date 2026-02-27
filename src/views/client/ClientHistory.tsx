import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'

export function ClientHistory() {
  const [searchParams] = useSearchParams()
  const fournisseurId = useMemo(() => searchParams.get('provider') ?? undefined, [searchParams])

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold text-zinc-100">Historique</h1>
        <p className="text-xs text-zinc-500">
          {fournisseurId ? 'Transactions pour ce commerce' : 'Toutes vos transactions'}
        </p>
      </header>
      <TransactionHistory fournisseur_id={fournisseurId} />
    </section>
  )
}
