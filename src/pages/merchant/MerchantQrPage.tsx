import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui'
import { MerchantQrShowcase } from '../../components/merchant/MerchantQrShowcase'

export default function MerchantQrPage() {
  const navigate = useNavigate()

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-dark">QR marchand</h1>
            <p className="mt-2 font-body text-sm text-gray-600">
              Affichage automatique du QR, pilotage en plein ecran et zone publicitaire associee.
            </p>
          </div>

          <Button variant="soft" onClick={() => navigate('/merchant/settings?tab=integrations')}>
            Configurer les intégrations
          </Button>
        </div>
      </header>

      <MerchantQrShowcase />
    </section>
  )
}