import { useEffect, useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { Button } from '../../components/ui'
import { supabase } from '../../shared/lib/supabaseClient'

export interface MerchantQrPayload {
  merchantId: string
  networkId: string | null
  timestamp: number
  signature: string
}

export interface QRGeneratorCardProps {
  merchantId: string
  networkId?: string | null
  className?: string
}

interface MerchantQrState {
  payload: MerchantQrPayload
  expiresAt: string
}

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

async function getAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session?.access_token ?? null
}

export async function generateMerchantQR(merchantId: string, networkId: string | null): Promise<MerchantQrState> {
  const timestamp = Date.now()
  const expiresAt = new Date(timestamp + TWENTY_FOUR_HOURS_MS).toISOString()

  const accessToken = await getAccessToken()
  const { data, error } = await supabase.functions.invoke<{ token?: string; signature?: string }>('generate-qr', {
    method: 'POST',
    body: {
      merchant_id: merchantId,
      network_id: networkId,
      ts: timestamp,
      mode: 'merchant_dashboard',
    },
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  })

  if (error) {
    throw new Error(error.message)
  }

  const signature = String(data?.signature ?? data?.token ?? `local-${merchantId}-${timestamp}`)

  return {
    payload: {
      merchantId,
      networkId,
      timestamp,
      signature,
    },
    expiresAt,
  }
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) {
    return '00:00:00'
  }

  const totalSeconds = Math.floor(msLeft / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function QRGeneratorCard({ merchantId, networkId = null, className = '' }: QRGeneratorCardProps) {
  const [qrState, setQrState] = useState<MerchantQrState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!qrState) return

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [qrState])

  const expiresIn = useMemo(() => {
    if (!qrState) return 0
    return new Date(qrState.expiresAt).getTime() - now
  }, [now, qrState])

  const isExpired = qrState ? expiresIn <= 0 : false
  const qrValue = qrState ? JSON.stringify(qrState.payload) : ''

  const handleGenerate = async () => {
    if (!merchantId || loading) return

    setLoading(true)
    setError(null)

    try {
      const generated = await generateMerchantQR(merchantId, networkId)
      setQrState(generated)
      setNow(Date.now())
      setLoading(false)
    } catch (caughtError) {
      setLoading(false)
      setError(caughtError instanceof Error ? caughtError.message : 'Impossible de generer ce QR')
    }
  }

  const handleDownload = () => {
    if (!qrState) return

    const canvas = document.getElementById('merchant-qr-canvas') as HTMLCanvasElement | null
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `merchant-qr-${merchantId}.png`
    link.click()
  }

  return (
    <section
      className={`rounded-xl border border-transparent p-4 text-white shadow-[0_18px_44px_rgba(255,107,53,0.32)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #FF6B35, #FF9800)' }}
    >
      <div className="flex items-start gap-3">
        <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <QrCode className="h-7 w-7" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-extrabold">Generateur QR</h3>
          <p className="mt-1 font-body text-sm text-white/90">Creez un QR securise pour le scan client en caisse.</p>
        </div>
      </div>

      <Button
        type="button"
        variant="white"
        size="md"
        onClick={handleGenerate}
        loading={loading}
        className="mt-4 w-full border-white bg-white text-[#C44A18] hover:bg-white/95"
      >
        {qrState ? 'Regenerer le QR' : 'Generer mon QR'}
      </Button>

      {qrState ? (
        <div className="mt-4 rounded-xl bg-white p-4 text-dark">
          <div className="flex flex-col items-center gap-3">
            <QRCodeCanvas id="merchant-qr-canvas" value={qrValue} size={200} includeMargin level="M" />
            <p className="font-body text-xs text-gray-600">
              Expire dans <span className="font-semibold text-dark">{formatCountdown(expiresIn)}</span>
            </p>
            {isExpired ? <p className="font-body text-xs text-rose-600">QR expire. Regenerer pour continuer.</p> : null}
          </div>

          <Button type="button" variant="ghost" size="sm" onClick={handleDownload} className="mt-3 w-full border border-gray-200 text-gray-700">
            Telecharger PNG
          </Button>
        </div>
      ) : null}

      {error ? <p className="mt-3 rounded-md bg-rose-950/35 px-3 py-2 font-body text-xs text-rose-100">{error}</p> : null}
    </section>
  )
}
