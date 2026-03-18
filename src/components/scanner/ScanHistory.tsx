import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { useScanHistory } from '../../hooks/useScanHistory'

export interface ScanHistoryProps {
  userId: string
}

function relativeTime(dateIso: string): string {
  const parsed = new Date(dateIso)
  if (Number.isNaN(parsed.getTime())) return 'à l instant'
  return formatDistanceToNow(parsed, { addSuffix: true, locale: fr })
}

export function ScanHistory({ userId }: ScanHistoryProps) {
  const navigate = useNavigate()
  const { scans, loading, error, latestInsertedId } = useScanHistory(userId, 4)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <header className="mb-2 flex items-center justify-between">
        <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Historique scans QR</p>
        <button
          type="button"
          onClick={() => navigate('/dashboard/transactions')}
          className="font-body text-xs font-semibold text-primary transition hover:opacity-80"
        >
          Tout voir →
        </button>
      </header>

      <div className="space-y-2">
        {scans.map((scan) => {
          const success = scan.status === 'success'
          const dotColor = success ? '#00C9A7' : '#E24B4A'

          return (
            <article
              key={scan.id}
              className={`flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 ${
                scan.id === latestInsertedId ? 'scan-slide-down' : ''
              }`}
            >
              <span className="mt-1.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} aria-hidden="true" />

              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-dark">{scan.merchant_name}</p>
                <p className="truncate font-body text-xs text-gray-500">
                  {relativeTime(scan.created_at)} · {scan.network_name}
                </p>

                {!success ? (
                  <p className="mt-1 font-body text-xs text-rose-700">
                    Scan échoué{scan.reason ? `: ${scan.reason}` : ''}
                  </p>
                ) : null}
              </div>

              <p className={`shrink-0 text-right font-body text-sm font-semibold ${success ? 'text-emerald-600' : 'text-rose-600'}`}>
                {success ? `+${scan.points.toLocaleString('fr-FR')} pts` : '—'}
              </p>
            </article>
          )
        })}

        {!loading && scans.length === 0 ? <p className="font-body text-sm text-gray-500">Aucun scan récent.</p> : null}
      </div>

      {loading ? <p className="pt-2 font-body text-xs text-gray-500">Chargement...</p> : null}
      {error ? <p className="pt-2 font-body text-xs text-rose-600">{error}</p> : null}

      <style>{`
        .scan-slide-down {
          animation: scan-slide-down 260ms ease-out both;
        }

        @keyframes scan-slide-down {
          0% {
            opacity: 0;
            transform: translateY(-10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  )
}
