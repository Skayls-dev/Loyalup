import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useMarketplaceInsights } from '../../hooks/useMarketplaceInsights'
import { logUserEvent } from '../../shared/lib/analytics'

type SortMode = 'performance' | 'rating' | 'newest' | 'points'

type DeliveryFilter = 'all' | 'in_store' | 'digital_code'

type OfferPrefs = {
  search: string
  delivery: DeliveryFilter
  sortBy: SortMode
  merchantId: string
}

const PAGE_SIZE = 14

function readSponsoredOfferIds(): Set<string> {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const raw = window.localStorage.getItem('loyalup_sponsored_offers')
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set<string>()
    const values = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
    return values.length > 0 ? new Set(values) : new Set<string>()
  } catch {
    return new Set<string>()
  }
}

export default function OffersExplorerPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { offers, loading, error } = useMarketplaceInsights()
  const [search, setSearch] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('q')?.trim() ?? ''
  })
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [sortBy, setSortBy] = useState<SortMode>('performance')
  const [selectedMerchantId, setSelectedMerchantId] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('merchantId')?.trim() ?? ''
  })
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [sponsoredOfferIds] = useState<Set<string>>(() => readSponsoredOfferIds())
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const key = `loyalup:offers:prefs:${user?.id ?? 'anon'}`
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      setPrefsHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<OfferPrefs>
      if (typeof parsed.search === 'string') setSearch(parsed.search)
      if (parsed.delivery === 'all' || parsed.delivery === 'in_store' || parsed.delivery === 'digital_code') {
        setDelivery(parsed.delivery)
      }
      if (parsed.sortBy === 'performance' || parsed.sortBy === 'rating' || parsed.sortBy === 'newest' || parsed.sortBy === 'points') {
        setSortBy(parsed.sortBy)
      }
      if (typeof parsed.merchantId === 'string') setSelectedMerchantId(parsed.merchantId)
    } catch {
      null
    } finally {
      setPrefsHydrated(true)
    }
  }, [user?.id])

  useEffect(() => {
    if (!prefsHydrated || typeof window === 'undefined') return
    const key = `loyalup:offers:prefs:${user?.id ?? 'anon'}`
    const payload: OfferPrefs = {
      search,
      delivery,
      sortBy,
      merchantId: selectedMerchantId,
    }
    window.localStorage.setItem(key, JSON.stringify(payload))
  }, [delivery, prefsHydrated, search, selectedMerchantId, sortBy, user?.id])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()

    const base = offers.filter((offer) => {
      const matchesSearch =
        normalized.length === 0
        || offer.name.toLowerCase().includes(normalized)
        || offer.merchantName.toLowerCase().includes(normalized)

      const matchesDelivery = delivery === 'all' || offer.rewardDeliveryType === delivery
      const matchesMerchant = selectedMerchantId.length === 0 || offer.merchantId === selectedMerchantId
      const isVisible = offer.active

      return matchesSearch && matchesDelivery && matchesMerchant && isVisible
    })

    return [...base].sort((a, b) => {
      if (sortBy === 'rating') return b.merchantAvgRating - a.merchantAvgRating
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'points') return a.pointsRequired - b.pointsRequired
      return b.performanceScore - a.performanceScore
    })
  }, [delivery, offers, search, selectedMerchantId, sortBy])

  const sponsoredOffers = useMemo(
    () => filtered.filter((offer) => sponsoredOfferIds.has(offer.offerId)),
    [filtered, sponsoredOfferIds],
  )

  const organicOffers = useMemo(
    () => filtered.filter((offer) => !sponsoredOfferIds.has(offer.offerId)),
    [filtered, sponsoredOfferIds],
  )

  const visibleOrganic = useMemo(() => organicOffers.slice(0, visibleCount), [organicOffers, visibleCount])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [delivery, search, selectedMerchantId, sortBy])

  useEffect(() => {
    if (!sentinelRef.current) return
    if (visibleCount >= organicOffers.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, organicOffers.length))
      },
      { rootMargin: '180px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [organicOffers.length, visibleCount])

  const handleOfferClick = async (offerId: string, merchantId: string, merchantName: string, placement: 'sponsored' | 'organic') => {
    await logUserEvent({
      userId: user?.id,
      eventType: 'marketplace_offer_click',
      properties: {
        offer_id: offerId,
        merchant_id: merchantId,
        merchant_name: merchantName,
        placement,
        filters: { search, delivery, sortBy, selectedMerchantId },
      },
      page: '/offers',
    })

    navigate(`/directory?q=${encodeURIComponent(merchantName)}`)
  }

  return (
    <section className="space-y-4">
      <header className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Catalogue unifie</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-dark">Toutes les offres</h1>
        <p className="mt-2 font-body text-sm text-gray-600">Trier par performance, note et recence pour trouver les meilleures opportunites.</p>
      </header>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <label className="lg:col-span-2">
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-gray-500">Recherche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom offre ou marchand"
                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary"
              />
            </div>
          </label>

          <label>
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-gray-500">Type</span>
            <select
              value={delivery}
              onChange={(event) => setDelivery(event.target.value as DeliveryFilter)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
            >
              <option value="all">Tous</option>
              <option value="in_store">En boutique</option>
              <option value="digital_code">Code digital</option>
            </select>
          </label>
        </div>

        <div className="mt-3">
          <label>
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-gray-500">Marchand</span>
            <select
              value={selectedMerchantId}
              onChange={(event) => setSelectedMerchantId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-primary"
            >
              <option value="">Tous les marchands</option>
              {Array.from(new Map(offers.map((offer) => [offer.merchantId, offer.merchantName])).entries()).map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            {([
              ['performance', 'Performance'],
              ['rating', 'Mieux notes'],
              ['newest', 'Nouveautes'],
              ['points', 'Points min'],
            ] as Array<[SortMode, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortBy(value)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${sortBy === value ? 'bg-white text-dark shadow-sm' : 'text-gray-500 hover:text-dark'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-gray-500">{filtered.length.toLocaleString('fr-FR')} offres</p>
        </div>
      </section>

      {sponsoredOffers.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-gray-500">Offres sponsorisees</p>
            <p className="font-body text-xs text-gray-500">Annonce</p>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sponsoredOffers.map((offer) => (
              <article key={`sponsored-${offer.offerId}`} className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-body text-base font-semibold text-dark">{offer.name}</h2>
                    <p className="mt-0.5 font-body text-xs text-gray-500">{offer.merchantName}</p>
                  </div>
                  <p className="rounded-full bg-amber-100 px-2.5 py-1 font-body text-xs font-semibold text-amber-700">Sponsorisee</p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { void handleOfferClick(offer.offerId, offer.merchantId, offer.merchantName, 'sponsored') }}
                    className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Voir le marchand
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visibleOrganic.map((offer) => (
          <article key={offer.offerId} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-body text-base font-semibold text-dark">{offer.name}</h2>
                <p className="mt-0.5 font-body text-xs text-gray-500">{offer.merchantName}</p>
              </div>
              <p className="rounded-full bg-primary-light px-2.5 py-1 font-body text-xs font-semibold text-primary">Score {offer.performanceScore}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600">Points: <span className="font-semibold text-dark">{offer.pointsRequired}</span></p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600">Type: <span className="font-semibold text-dark">{offer.rewardDeliveryType === 'digital_code' ? 'Digital' : 'Boutique'}</span></p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600">Conversion: <span className="font-semibold text-dark">{Math.round(offer.conversionRate * 100)}%</span></p>
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-600">Note marchand: <span className="font-semibold text-dark">{offer.merchantRatingCount > 0 ? offer.merchantAvgRating.toFixed(1) : 'N/A'}</span></p>
            </div>

            {offer.badges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {offer.badges.map((badge) => (
                  <span key={`${offer.offerId}-${badge}`} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">{badge}</span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => { void handleOfferClick(offer.offerId, offer.merchantId, offer.merchantName, 'organic') }}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Voir le marchand
              </button>
            </div>
          </article>
        ))}
      </section>

      <div ref={sentinelRef} className="h-4" />

      {loading ? <p className="font-body text-xs text-gray-500">Chargement des offres...</p> : null}
      {!loading && filtered.length === 0 ? <p className="font-body text-sm text-gray-500">Aucune offre active ne correspond aux filtres.</p> : null}
      {!loading && visibleOrganic.length < organicOffers.length ? (
        <p className="font-body text-xs text-gray-500">Chargement progressif: {visibleOrganic.length}/{organicOffers.length}</p>
      ) : null}
      {error ? <p className="font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
