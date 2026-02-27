import { useNetworkLeaderboard } from '../../hooks/useNetworkLeaderboard'

type NetworkLeaderboardProps = {
  network_id: string
}

export function NetworkLeaderboard({ network_id }: NetworkLeaderboardProps) {
  const { entries, myRank, myScore, loading, error } = useNetworkLeaderboard(network_id, 50)

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-zinc-800/70" />
  }

  if (error) {
    return <p className="text-xs text-red-300">{error.message}</p>
  }

  return (
    <section className="space-y-2 rounded-xl border border-zinc-700 bg-zinc-900/70 p-4 text-sm">
      <p className="text-zinc-300">Classement réseau (Top 50)</p>
      <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
        Votre rang : {myRank ? `#${myRank}` : '--'} · Score : {myScore ?? '--'}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-zinc-400">Aucun score réseau pour le moment.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.client_id}
              className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${
                entry.is_current_user
                  ? 'border-indigo-600 bg-indigo-950/40 text-indigo-100'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-300'
              }`}
            >
              <span>#{entry.rank} · {entry.client_name}</span>
              <span className="font-semibold">{entry.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
