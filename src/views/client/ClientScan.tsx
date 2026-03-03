import { Camera, Keyboard, Upload } from 'lucide-react'
import { QRScanner } from '../../modules/qr/components/QRScanner'
import { PrimaryButton, SecondaryButton } from '../../shared/components/client-ui'

export function ClientScan() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-4 text-center shadow-sm shadow-slate-900/5 backdrop-blur-xl">
        <div className="mx-auto mb-2 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
          <Camera className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Scanner un QR LoyalUp</h1>
        <p className="mt-1 text-sm text-slate-500">Cadrez le QR du commerçant pour valider votre visite et gagner vos points.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <PrimaryButton type="button" className="h-10">Scan en direct</PrimaryButton>
          <SecondaryButton type="button" className="h-10" disabled>
            <Upload className="mr-1.5 h-4 w-4" />
            Photo (bientôt)
          </SecondaryButton>
          <SecondaryButton type="button" className="h-10" disabled>
            <Keyboard className="mr-1.5 h-4 w-4" />
            Code manuel (bientôt)
          </SecondaryButton>
        </div>
      </div>

      <QRScanner />
    </section>
  )
}
