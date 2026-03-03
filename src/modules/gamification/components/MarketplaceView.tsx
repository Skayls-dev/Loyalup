import { useState } from 'react'
import { useReferral } from '../hooks'

interface MarketplaceViewProps {
}

export function MarketplaceView({}: MarketplaceViewProps) {
  const {
    sourceProviders,
    transferOptions,
    transferOptionsLoading,
    transfer,
    loading,
    error,
    loadTransferOptions,
  } = useReferral()
  
  const [fromProvider, setFromProvider] = useState<string>('')
  const [toProvider, setToProvider] = useState<string>('')
  const [amount, setAmount] = useState<number>(100)
  const [showPreview, setShowPreview] = useState(false)

  const selectedSource = sourceProviders.find((provider) => provider.id === fromProvider)

  const selectedOption = transferOptions.find((o) => o.to_fournisseur_id === toProvider)
  const fee = selectedOption ? Math.floor(amount * selectedOption.fee_pct) : 0
  const amountAfterFee = amount - fee
  const creditsReceived = selectedOption
    ? Math.floor(amountAfterFee * selectedOption.conversion_rate)
    : 0

  const handleTransfer = async () => {
    if (!fromProvider || !toProvider || amount < 10) {
      alert('Veuillez remplir tous les champs correctement')
      return
    }

    try {
      await transfer(fromProvider, toProvider, amount)
      setAmount(100)
      setFromProvider('')
      setToProvider('')
      setShowPreview(false)
      alert('Transfert réussi!')
    } catch (err) {
      console.error('Transfer failed:', err)
    }
  }

  return (
    <div className="space-y-4">
      {/* Explanation */}
      <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
        <h3 className="mb-2 text-lg font-bold text-slate-900">🏪 Place de Marché</h3>
        <p className="text-sm text-slate-600">
          Transférez vos points entre partenaires de la même coalition
        </p>
      </div>

      {/* Transfer form */}
      <div className="space-y-4 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm shadow-slate-900/5">
        {/* From provider */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            De quel partenaire
          </label>
          <select
            value={fromProvider}
            onChange={async (e) => {
              const nextFrom = e.target.value
              setFromProvider(nextFrom)
              setToProvider('')
              setShowPreview(false)
              await loadTransferOptions(nextFrom)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">-- Sélectionner --</option>
            {sourceProviders.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({provider.balance} pts)
              </option>
            ))}
          </select>
          {sourceProviders.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">
              Aucun partenaire source trouvé. Vous devez avoir des points chez au moins un partenaire.
            </p>
          )}
        </div>

        {/* To provider */}
        {fromProvider && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Vers quel partenaire
            </label>
            {transferOptionsLoading ? (
              <p className="text-sm text-gray-600">Chargement des partenaires de destination...</p>
            ) : transferOptions.length === 0 ? (
              <p className="text-sm text-amber-700">
                Aucun partenaire de destination disponible pour{' '}
                <span className="font-semibold">{selectedSource?.name ?? 'ce partenaire'}</span>.
                Vérifiez qu'il appartient à une coalition avec d'autres partenaires actifs.
              </p>
            ) : (
              <div className="space-y-3">
                <select
                  value={toProvider}
                  onChange={(e) => {
                    setToProvider(e.target.value)
                    setShowPreview(false)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choisir le partenaire destinataire --</option>
                  {transferOptions.map((option) => (
                    <option key={option.to_fournisseur_id} value={option.to_fournisseur_id}>
                      {option.provider_name}
                    </option>
                  ))}
                </select>

                {toProvider && selectedOption ? (
                  <div className="p-3 border border-purple-200 bg-purple-50 rounded-lg text-xs text-gray-700">
                    <p>
                      Destination: <span className="font-semibold">{selectedOption.provider_name}</span>
                    </p>
                    <p>
                      Taux de conversion: <span className="font-semibold">{(selectedOption.conversion_rate * 100).toFixed(0)}%</span>
                      {' '}· Frais: <span className="font-semibold">{(selectedOption.fee_pct * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Amount */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre de points (min. 10)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="10"
              step="10"
              value={amount}
              onChange={(e) => setAmount(Math.max(10, parseInt(e.target.value) || 10))}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setShowPreview(!showPreview)}
              disabled={!fromProvider || !toProvider}
              className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Aperçu
            </button>
          </div>
        </div>

        {/* Preview */}
        {showPreview && selectedOption && (
          <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
            <h4 className="font-bold text-slate-900">📊 Aperçu du transfert</h4>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">Points envoyés</span>
                <span className="font-semibold text-gray-800">{amount}</span>
              </div>
              <div className="flex justify-between text-red-600">
                <span>Frais ({(selectedOption.fee_pct * 100).toFixed(0)}%)</span>
                <span className="font-semibold">-{fee}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between">
                <span className="text-gray-700">Après frais</span>
                <span className="font-semibold text-gray-800">{amountAfterFee}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>Conversion ({(selectedOption.conversion_rate * 100).toFixed(0)}%)</span>
                <span className="font-semibold">×{selectedOption.conversion_rate}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between text-lg">
                <span className="font-bold text-gray-800">Vous recevrez</span>
                <span className="font-bold text-green-600">{creditsReceived}</span>
              </div>
            </div>

            <button
              onClick={handleTransfer}
              disabled={loading}
              className="w-full rounded-lg bg-emerald-600 py-2 font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading ? '⏳ Transfert...' : '✅ Confirmer le transfert'}
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {error.message}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-800">
        <p>💡 Les points transférés reviennent immédiatement à vous sous forme de points LoyalUp</p>
      </div>
    </div>
  )
}

