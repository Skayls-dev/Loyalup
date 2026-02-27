import { useEffect, useMemo, useState } from 'react'
import { getAllNetworks } from '../../services/networkService'
import { useProviderNetworks } from '../../hooks/useProviderNetworks'
import type { Network } from '../../types/networkTypes'
import { JoinNetworkModal } from './JoinNetworkModal'
import { NetworkProviderStats } from './NetworkProviderStats'

export function ProviderNetworkHub() {
  const { active, pending, requestJoin, leave, refresh, loading, error } = useProviderNetworks()
  const [discover, setDiscover] = useState<Network[]>([])
  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterCoalition, setFilterCoalition] = useState<'all' | 'yes' | 'no'>('all')
  const [benefitNetworkId, setBenefitNetworkId] = useState<string>('')
  const [avgValue, setAvgValue] = useState<number>(18)
  const [monthlyTx, setMonthlyTx] = useState<number>(320)

  useEffect(() => {
    void getAllNetworks().then(setDiscover).catch(() => setDiscover([]))
  }, [])

  const activeIds = new Set(active.map((item) => item.network.id))

  const filteredDiscover = useMemo(() => {
    return discover.filter((network) => {
      if (activeIds.has(network.id)) {
        return false
      }

      if (filterCategory !== 'all' && network.category !== filterCategory) {
        return false
      }

      if (filterCoalition === 'yes' && !network.coalition_enabled) {
        return false
      }

      if (filterCoalition === 'no' && network.coalition_enabled) {
        return false
      }

      return true
    })
  }, [activeIds, discover, filterCategory, filterCoalition])

  const selectedBenefitNetwork = discover.find((network) => network.id === benefitNetworkId) ?? discover[0] ?? null

  const estimatedExtraPoints = selectedBenefitNetwork
    ? Math.floor(avgValue * monthlyTx * (selectedBenefitNetwork.points_multiplier - 1))
    : 0

  const estimatedValueEuro = Math.round((estimatedExtraPoints / 100) * 100) / 100

  const firstActiveNetwork = active[0]?.network

  return (
    <section className="space-y-4 rounded-2xl border border-zinc-700 bg-zinc-900/85 p-4 text-zinc-100 shadow-sm">
      <header>
        <h2 className="text-xl font-semibold">Réseaux</h2>
        <p className="text-sm text-zinc-400">Découverte, adhésion et pilotage de vos réseaux thématiques.</p>
      </header>

      <section className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h3 className="text-sm font-semibold">Mes réseaux</h3>
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-zinc-800/70" />
        ) : active.length === 0 ? (
          <p className="text-xs text-zinc-400">Aucun réseau actif.</p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {active.map((item) => (
              <div key={item.network.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-zinc-100">{item.network.emoji} {item.network.name.fr ?? item.network.slug}</p>
                  <span className="rounded bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700">
                    {item.network.points_multiplier.toFixed(2)}x
                  </span>
                </div>
                <p className="mt-1 text-zinc-400">Clients réseau: {item.network.client_count}</p>
                <p className="text-zinc-400">Statut : {item.status}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBenefitNetworkId(item.network.id)}
                    className="rounded bg-zinc-800 px-2 py-1"
                  >
                    Voir les stats réseau
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void leave(item.network.id)
                    }}
                    className="rounded bg-red-900/50 px-2 py-1 text-red-200"
                  >
                    Quitter le réseau
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {error ? <p className="text-xs text-red-300">{error.message}</p> : null}

        {firstActiveNetwork ? <NetworkProviderStats network_id={firstActiveNetwork.id} /> : null}
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h3 className="text-sm font-semibold">Demandes en attente</h3>
        {pending.length === 0 ? (
          <p className="text-xs text-zinc-400">Aucune demande en attente.</p>
        ) : (
          <div className="space-y-2">
            {pending.map((item) => (
              <div key={item.network.id} className="rounded border border-zinc-800 px-2 py-1 text-xs">
                <p className="text-zinc-100">{item.network.emoji} {item.network.name.fr ?? item.network.slug}</p>
                <p className="text-zinc-500">En attente de validation</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h3 className="text-sm font-semibold">Découvrir des réseaux</h3>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterCategory}
            onChange={(event) => setFilterCategory(event.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            <option value="all">Toutes catégories</option>
            {Array.from(new Set(discover.map((network) => network.category))).map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            value={filterCoalition}
            onChange={(event) => setFilterCoalition(event.target.value as typeof filterCoalition)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            <option value="all">Coalition : tous</option>
            <option value="yes">Coalition uniquement</option>
            <option value="no">Sans coalition</option>
          </select>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {filteredDiscover.map((network) => (
            <div key={network.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs">
              <p className="font-semibold text-zinc-100">{network.emoji} {network.name.fr ?? network.slug}</p>
              <p className="text-zinc-400">{network.category} · {network.points_multiplier.toFixed(2)}x</p>
              <p className="text-zinc-500">{network.member_count} membres · {network.client_count} clients</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedNetwork(network)}
                  className="rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700"
                >
                  {network.membership_type === 'open' ? 'Rejoindre' : 'Demander à rejoindre'}
                </button>
                {network.membership_type === 'open' ? (
                  <button
                    type="button"
                    onClick={() => {
                      void requestJoin({ networkId: network.id })
                    }}
                    className="rounded bg-emerald-500 px-2 py-1 text-xs font-semibold text-zinc-950"
                  >
                    Rejoindre maintenant
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {filteredDiscover.length === 0 ? <p className="text-xs text-zinc-400">Aucun réseau ne correspond aux filtres.</p> : null}
      </section>

      <section className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-3">
        <h3 className="text-sm font-semibold">Simulateur de bénéfices réseau</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={selectedBenefitNetwork?.id ?? ''}
            onChange={(event) => setBenefitNetworkId(event.target.value)}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
          >
            {discover.map((network) => (
              <option key={network.id} value={network.id}>
                {network.emoji} {network.name.fr ?? network.slug}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={avgValue}
            onChange={(event) => setAvgValue(Number(event.target.value || '0'))}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            placeholder="Panier moyen"
          />
          <input
            type="number"
            value={monthlyTx}
            onChange={(event) => setMonthlyTx(Number(event.target.value || '0'))}
            className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            placeholder="Transactions/mois"
          />
        </div>

        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs">
          <p>Vos clients gagneraient <span className="font-semibold text-emerald-300">{estimatedExtraPoints.toLocaleString()} pts</span> de plus / mois.</p>
          <p>Cela représente <span className="font-semibold text-indigo-300">{estimatedValueEuro.toLocaleString()} €</span> de valeur perçue supplémentaire.</p>
          {selectedBenefitNetwork ? (
            <button
              type="button"
              onClick={() => setSelectedNetwork(selectedBenefitNetwork)}
              className="mt-2 rounded bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700"
            >
              Rejoindre ce réseau
            </button>
          ) : null}
        </div>
      </section>

      {selectedNetwork ? (
        <JoinNetworkModal
          network={selectedNetwork}
          onClose={() => setSelectedNetwork(null)}
          onSuccess={() => {
            setSelectedNetwork(null)
            void refresh()
          }}
        />
      ) : null}
    </section>
  )
}
