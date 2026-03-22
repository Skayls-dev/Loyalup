import { TrendingUp, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PointsActivityChart } from '../../components/dashboard/PointsActivityChart'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { LoyaltyCardList } from '../../modules/loyalty/components/LoyaltyCardList'
import { Badge, PageHeader, SectionCard } from '../../shared/components/client-ui'

export default function ClientPointsPage() {
  const { user } = useAuth()
  const userId = user?.id ?? ''

  return (
    <section className="space-y-4">
      <PageHeader
        title="Mes points"
        subtitle="Retrouvez vos cartes fidélité, votre total cumulé et la dynamique récente de vos gains."
        rightActions={<Badge variant="primary">Vue fidélité</Badge>}
      />

      {userId ? (
        <PointsActivityChart userId={userId} weeks={10} />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-600">Connectez-vous pour consulter votre activité points.</p>
        </SectionCard>
      )}

      <SectionCard className="flex flex-wrap items-center justify-between gap-3 border-indigo-100 bg-gradient-to-r from-indigo-50 to-white">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Parrainez un ami</h2>
            <p className="text-sm text-slate-600">Partagez votre lien perso et gagnez un bonus quand votre ami realise son premier achat valide.</p>
          </div>
        </div>
        <Link
          to="/dashboard/referral"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Ouvrir le parrainage
        </Link>
      </SectionCard>

      <SectionCard className="flex flex-wrap items-center justify-between gap-3 border-amber-100 bg-gradient-to-r from-amber-50 to-white">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Transferer mes points</h2>
            <p className="text-sm text-slate-600">Deplacez des points entre marchands du meme reseau, avec apercu des frais et conversion avant validation.</p>
          </div>
        </div>
        <Link
          to="/dashboard/transfers"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Ouvrir les transferts
        </Link>
      </SectionCard>

      <SectionCard className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Programmes actifs</h2>
            <p className="text-sm text-slate-500">Suivez vos progressions par marchand et rechargez les données si besoin.</p>
          </div>
        </div>

        <LoyaltyCardList />
      </SectionCard>
    </section>
  )
}
