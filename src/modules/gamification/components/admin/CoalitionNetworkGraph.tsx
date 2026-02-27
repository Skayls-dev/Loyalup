interface CoalitionNode {
  coalition_id: string
  coalition_name: string
  total_members: number
  total_transfers: number
}

interface CoalitionNetworkGraphProps {
  coalitions: CoalitionNode[]
}

export function CoalitionNetworkGraph({ coalitions }: CoalitionNetworkGraphProps) {
  const width = 720
  const height = 320
  const centerX = width / 2
  const centerY = height / 2
  const radius = 110

  if (coalitions.length === 0) {
    return <div className="text-center py-8 text-gray-600">Aucune coalition active à visualiser</div>
  }

  const maxMembers = Math.max(...coalitions.map((c) => c.total_members), 1)

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[680px]">
        <circle cx={centerX} cy={centerY} r={40} fill="#4338ca" opacity="0.9" />
        <text x={centerX} y={centerY - 6} textAnchor="middle" className="fill-white text-xs font-bold">
          Réseau
        </text>
        <text x={centerX} y={centerY + 12} textAnchor="middle" className="fill-indigo-100 text-[10px]">
          Coalitions
        </text>

        {coalitions.slice(0, 10).map((coalition, index, arr) => {
          const angle = (index / arr.length) * Math.PI * 2
          const nodeX = centerX + radius * Math.cos(angle)
          const nodeY = centerY + radius * Math.sin(angle)
          const nodeSize = 10 + Math.round((coalition.total_members / maxMembers) * 12)
          const transferOpacity = Math.min(1, 0.2 + coalition.total_transfers / 50)

          return (
            <g key={coalition.coalition_id}>
              <line
                x1={centerX}
                y1={centerY}
                x2={nodeX}
                y2={nodeY}
                stroke="#a5b4fc"
                strokeWidth={2}
                opacity={transferOpacity}
              />
              <circle cx={nodeX} cy={nodeY} r={nodeSize} fill="#0ea5e9" opacity="0.9" />
              <text x={nodeX} y={nodeY + 4} textAnchor="middle" className="fill-white text-[10px] font-bold">
                {coalition.total_members}
              </text>
              <text x={nodeX} y={nodeY + nodeSize + 14} textAnchor="middle" className="fill-gray-700 text-[10px]">
                {coalition.coalition_name.slice(0, 12)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}



