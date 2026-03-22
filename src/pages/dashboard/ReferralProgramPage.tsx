import { Link } from 'react-router-dom'
import { ReferralView } from '../../modules/gamification/components'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ReferralProgramPage() {
  return (
    <section className="space-y-4">
      <PageHeader
        title="Parrainage"
        subtitle="Invitez vos amis avec votre lien personnel et suivez les activations puis les bonus debloques."
        rightActions={<Badge variant="primary">Double bonus</Badge>}
      />

      <SectionCard className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Comment ca marche</h2>
            <p className="text-sm text-slate-500">Votre ami active votre lien, realise son premier achat valide, puis vous recevez tous les deux un bonus.</p>
          </div>
          <Link
            to="/points"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Voir mes points
          </Link>
        </div>
      </SectionCard>

      <ReferralView language="fr" />
    </section>
  )
}