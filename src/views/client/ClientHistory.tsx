import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TransactionHistory } from '../../modules/loyalty/components/TransactionHistory'
import { PageHeader } from '../../shared/components/client-ui'

export function ClientHistory() {
  const [searchParams] = useSearchParams()
  const fournisseurId = useMemo(() => searchParams.get('provider') ?? undefined, [searchParams])

  return (
    <section className="space-y-4">
      <PageHeader
        title="Historique"
        subtitle={fournisseurId ? 'Transactions pour ce commerce' : 'Toutes vos transactions'}
      />
      <TransactionHistory fournisseur_id={fournisseurId} />
    </section>
  )
}
