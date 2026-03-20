import { MerchantQrShowcase } from '../../components/merchant/MerchantQrShowcase'

export default function MerchantQrPage() {
  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <h1 className="font-display text-3xl font-extrabold text-dark">QR marchand</h1>
        <p className="mt-2 font-body text-sm text-gray-600">
          Affichage automatique du QR, pilotage en plein ecran et zone publicitaire associee.
        </p>
      </header>

      <MerchantQrShowcase />
    </section>
  )
}