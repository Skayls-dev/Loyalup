import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../modules/auth/hooks/useAuth'
import { useMerchantDirectorySearch } from '../../hooks/useMerchantDirectorySearch'
import { logUserEvent } from '../../shared/lib/analytics'

type SortMode = 'performance' | 'rating' | 'transactions' | 'offers'

type DeliveryFilter = 'all' | 'in_store' | 'digital_code'

type DirectoryPrefs = {
  search: string
  minRating: number
  delivery: DeliveryFilter
  sortBy: SortMode
}

const PAGE_SIZE = 12

function readSponsoredMerchantIds(): Set<string> {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const raw = window.localStorage.getItem('loyalup_sponsored_merchants')
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set<string>()
    const values = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0)
    return values.length > 0 ? new Set(values) : new Set<string>()
  } catch {
    return new Set<string>()
  }
}

export default function MerchantDirectoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchInput, setSearchInput] = useState(() => {
    const params = new URLSearchParams(location.search)
    return params.get('q')?.trim() ?? ''
  })
  const [minRating, setMinRating] = useState(0)
  const [delivery, setDelivery] = useState<DeliveryFilter>('all')
  const [sortBy, setSortBy] = useState<SortMode>('performance')
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  const [sponsoredMerchantIds] = useState<Set<string>>(() => readSponsoredMerchantIds())
  const deferredSearch = useDeferredValue(searchInput)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const {
    rows: merchants,
    totalCount,
    loading,
    error,
    hasMore,
    loadMore,
  } = useMerchantDirectorySearch({
    search: deferredSearch,
    minRating,
    delivery,
    sortBy,
    pageSize: PAGE_SIZE,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = `loyalup:directory:prefs:${user?.id ?? 'anon'}`
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      setPrefsHydrated(true)
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<DirectoryPrefs>
      if (typeof parsed.search === 'string') setSearchInput(parsed.search)
      if (typeof parsed.minRating === 'number') setMinRating(parsed.minRating)
      if (parsed.delivery === 'all' || parsed.delivery === 'in_store' || parsed.delivery === 'digital_code') {
        setDelivery(parsed.delivery)
      }
      if (parsed.sortBy === 'performance' || parsed.sortBy === 'rating' || parsed.sortBy === 'transactions' || parsed.sortBy === 'offers') {
        setSortBy(parsed.sortBy)
      }
    } catch {
      null
    } finally {
      setPrefsHydrated(true)
    }
  }, [user?.id])

  useEffect(() => {
    if (!prefsHydrated || typeof window === 'undefined') return
    const key = `loyalup:directory:prefs:${user?.id ?? 'anon'}`
    const payload: DirectoryPrefs = { search: searchInput, minRating, delivery, sortBy }
    window.localStorage.setItem(key, JSON.stringify(payload))
  }, [delivery, minRating, prefsHydrated, searchInput, sortBy, user?.id])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const topCities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const merchant of merchants) {
      const city = merchant.city?.trim()
      if (!city) continue
      counts.set(city, (counts.get(city) ?? 0) + 1)
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([city]) => city)
  }, [merchants])

  const sponsoredMerchants = useMemo(
    () => merchants.filter((merchant) => sponsoredMerchantIds.has(merchant.merchantId)),
    [merchants, sponsoredMerchantIds],
  )

  const organicMerchants = useMemo(
    () => merchants.filter((merchant) => !sponsoredMerchantIds.has(merchant.merchantId)),
    [merchants, sponsoredMerchantIds],
  )

  const directoryKpis = useMemo(() => {
    const totalOffers = merchants.reduce((sum, merchant) => sum + merchant.activeOffers, 0)
    const avgRating = merchants.length > 0
      ? merchants.reduce((sum, merchant) => sum + merchant.avgRating, 0) / merchants.length
      : 0

    return {
      merchantCount: totalCount,
      shownCount: merchants.length,
      offerCount: totalOffers,
      avgRating,
    }
  }, [merchants, totalCount])

  useEffect(() => {
    if (!sentinelRef.current) return
    if (!hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (!entry?.isIntersecting) return
        void loadMore()
      },
      { rootMargin: '180px 0px' },
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadMore, loading])

  const handleMerchantClick = async (merchantId: string, merchantName: string, placement: 'sponsored' | 'organic') => {
    await logUserEvent({
      userId: user?.id,
      eventType: 'marketplace_merchant_click',
      properties: {
        merchant_id: merchantId,
        merchant_name: merchantName,
        placement,
        filters: { search: deferredSearch, minRating, delivery, sortBy },
      },
      page: '/directory',
    })

    navigate(`/offers?merchantId=${encodeURIComponent(merchantId)}`)
  }

  return (
    <section className="space-y-5">
      <header className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-[#fff8e8] via-white to-[#e9f4ff] p-6 shadow-[0_20px_65px_rgba(15,23,42,0.08)]">
        <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-[#ffbe0b]/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-[#3a86ff]/15 blur-2xl" />
        <p className="font-body text-xs uppercase tracking-[0.2em] text-slate-500">Annuaire Looyaal</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-slate-900 sm:text-4xl">Trouvez vite le bon marchand</h1>
        <p className="mt-2 max-w-2xl font-body text-sm text-slate-600">
          Recherche instantanee, filtres rapides et chargement progressif pour garder une experience fluide, meme avec beaucoup de marchands.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <label className="lg:col-span-2">
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-slate-500">Recherche rapide</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchInputRef}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Nom marchand ou ville"
                className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 pl-9 pr-20 text-sm text-slate-900 placeholder:text-slate-500 outline-none transition focus:border-primary focus:bg-slate-50"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                Ctrl K
              </span>
            </div>
          </label>

          <label>
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-slate-500">Note minimum</span>
            <select
              value={minRating}
              onChange={(event) => setMinRating(Number(event.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-slate-50"
            >
              <option value={0} className="text-slate-900">Toutes</option>
              <option value={3} className="text-slate-900">3+</option>
              <option value={4} className="text-slate-900">4+</option>
              <option value={4.5} className="text-slate-900">4.5+</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block font-body text-xs uppercase tracking-[0.12em] text-slate-500">Type d offre</span>
            <select
              value={delivery}
              onChange={(event) => setDelivery(event.target.value as DeliveryFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary focus:bg-slate-50"
            >
              <option value="all" className="text-slate-900">Tous</option>
              <option value="in_store" className="text-slate-900">En boutique</option>
              <option value="digital_code" className="text-slate-900">Code digital</option>
            </select>
          </label>
        </div>

        {topCities.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <p className="font-body text-xs uppercase tracking-[0.12em] text-slate-500">Villes frequentes</p>
            {topCities.map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => setSearchInput(city)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-primary/40 hover:text-primary"
              >
                {city}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {([
              ['performance', 'Pertinence'],
              ['rating', 'Note'],
              ['transactions', 'Volume'],
              ['offers', 'Offres actives'],
            ] as Array<[SortMode, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSortBy(value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${sortBy === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-slate-500">{totalCount.toLocaleString('fr-FR')} marchands</p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-slate-500">Marchands</p>
            <p className="mt-1 font-display text-xl font-extrabold text-slate-900">{directoryKpis.merchantCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-slate-500">Affiches</p>
            <p className="mt-1 font-display text-xl font-extrabold text-slate-900">{directoryKpis.shownCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-slate-500">Offres actives</p>
            <p className="mt-1 font-display text-xl font-extrabold text-slate-900">{directoryKpis.offerCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-slate-500">Note moyenne</p>
            <p className="mt-1 font-display text-xl font-extrabold text-slate-900">
              {directoryKpis.avgRating > 0 ? directoryKpis.avgRating.toFixed(1) : 'N/A'}
            </p>
          </div>
        </div>
      </section>

      {sponsoredMerchants.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-body text-xs uppercase tracking-[0.14em] text-slate-500">Mise en avant</p>
            <p className="font-body text-xs text-slate-500">Annonce</p>
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {sponsoredMerchants.map((merchant) => (
              <article key={`sponsored-${merchant.merchantId}`} className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-[0_10px_30px_rgba(217,119,6,0.12)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-body text-base font-semibold text-slate-900">{merchant.merchantName}</h2>
                    <p className="mt-0.5 font-body text-xs text-slate-500">{merchant.city ?? merchant.address ?? 'Adresse non renseignee'}</p>
                  </div>
                  <p className="rounded-full bg-amber-100 px-2.5 py-1 font-body text-xs font-semibold text-amber-700">Sponsorise</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="rounded-lg border border-amber-200/70 bg-white px-2 py-1.5 text-slate-600">Transactions: <span className="font-semibold text-slate-900">{merchant.transactions30d}</span></p>
                  <p className="rounded-lg border border-amber-200/70 bg-white px-2 py-1.5 text-slate-600">Score: <span className="font-semibold text-slate-900">{merchant.performanceScore}</span></p>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { void handleMerchantClick(merchant.merchantId, merchant.merchantName, 'sponsored') }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:-translate-y-[1px] hover:border-primary/40 hover:text-primary"
                  >
                    Voir les offres
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {organicMerchants.map((merchant) => (
          <article
            key={merchant.merchantId}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-[2px] hover:shadow-[0_16px_38px_rgba(15,23,42,0.10)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-body text-lg font-semibold text-slate-900">{merchant.merchantName}</h2>
                <p className="mt-0.5 font-body text-xs text-slate-500">{merchant.city ?? merchant.address ?? 'Adresse non renseignee'}</p>
              </div>
              <p className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-body text-xs font-semibold text-sky-700">Score {merchant.performanceScore}</p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Transactions 30j: <span className="font-semibold text-slate-900">{merchant.transactions30d}</span></p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Offres actives: <span className="font-semibold text-slate-900">{merchant.activeOffers}</span></p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">Conversion moy.: <span className="font-semibold text-slate-900">{Math.round(merchant.avgOfferConversionRate * 100)}%</span></p>
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-600">
                <Star className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold text-slate-900">{merchant.ratingCount > 0 ? merchant.avgRating.toFixed(1) : 'N/A'}</span>
              </p>
            </div>

            {merchant.badges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {merchant.badges.map((badge) => (
                  <span key={`${merchant.merchantId}-${badge}`} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{badge}</span>
                ))}
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => { void handleMerchantClick(merchant.merchantId, merchant.merchantName, 'organic') }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition group-hover:border-primary/40 group-hover:text-primary"
              >
                Voir les offres
              </button>
            </div>
          </article>
        ))}
      </section>

      <div ref={sentinelRef} className="h-4" />

      {loading ? <p className="font-body text-xs text-slate-500">Chargement de l annuaire...</p> : null}
      {!loading && merchants.length === 0 ? <p className="font-body text-sm text-slate-500">Aucun marchand ne correspond aux filtres.</p> : null}
      {!loading && hasMore ? (
        <p className="font-body text-xs text-slate-500">Chargement progressif: {merchants.length}/{totalCount}</p>
      ) : null}
      {error ? <p className="font-body text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
