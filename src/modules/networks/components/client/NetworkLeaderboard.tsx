import { useNetworkLeaderboard } from '../../hooks/useNetworkLeaderboard'

type NetworkLeaderboardProps = {
  network_id: string
}

export function NetworkLeaderboard({ network_id }: NetworkLeaderboardProps) {
  const { entries, myRank, myScore, loading, error } = useNetworkLeaderboard(network_id, 50)

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-slate-200/80" />
  }

  if (error) {
    return <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error.message}</p>
  }

  return (
    <section className="space-y-2 rounded-xl border border-white/70 bg-white/85 p-4 text-sm shadow-sm shadow-slate-900/5">
      <p className="text-slate-600">Classement réseau (Top 50)</p>
      <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Votre rang : {myRank ? `#${myRank}` : '--'} · Score : {myScore ?? '--'}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">Aucun score réseau pour le moment.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.client_id}
              className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${
                entry.is_current_user
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600'
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
