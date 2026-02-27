import type { ProviderCoalition } from '../../services/networkService'

interface CoalitionCardProps {
  coalition: ProviderCoalition
  isSelected?: boolean
  onSelect?: (coalition: ProviderCoalition) => void
}

export function CoalitionCard({
  coalition,
  isSelected = false,
  onSelect,
}: CoalitionCardProps) {
  return (
    <div
      onClick={() => onSelect?.(coalition)}
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-blue-300'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {coalition.logo_url && (
          <img
            src={coalition.logo_url}
            alt={coalition.name}
            className="w-12 h-12 rounded object-cover"
          />
        )}
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">{coalition.name}</h3>
          <p className="text-xs text-gray-600">ID: {coalition.id.slice(0, 8)}</p>
        </div>
        {coalition.is_active ? (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
            ✓ Active
          </span>
        ) : (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
            ✗ Inactive
          </span>
        )}
      </div>

      {/* Description */}
      {coalition.description && (
        <p className="text-sm text-gray-700 mb-3">{coalition.description}</p>
      )}

      {/* Terms */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold text-gray-700">Taux de conversion</div>
          <div className="text-lg font-bold text-blue-600">
            {(coalition.conversion_rate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <div className="font-semibold text-gray-700">Frais plateforme</div>
          <div className="text-lg font-bold text-red-600">
            {(coalition.platform_fee_pct * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  )
}



