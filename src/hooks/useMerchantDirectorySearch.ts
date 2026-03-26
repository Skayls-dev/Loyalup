import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../shared/lib/supabaseClient'

export type DirectorySortMode = 'performance' | 'rating' | 'transactions' | 'offers'
export type DirectoryDeliveryFilter = 'all' | 'in_store' | 'digital_code'

export type DirectoryMerchant = {
  merchantId: string
  merchantName: string
  address: string | null
  city: string | null
  avgRating: number
  ratingCount: number
  activeOffers: number
  transactions30d: number
  avgOfferConversionRate: number
  performanceScore: number
  badges: Array<'Top conversion' | 'Mieux note' | 'Nouveau'>
}

type DirectorySearchRow = {
  merchant_id: string
  merchant_name: string
  address: string | null
  city: string | null
  avg_rating: number | null
  rating_count: number | null
  active_offers: number | null
  transactions_30d: number | null
  avg_offer_conversion_rate: number | null
  performance_score: number | null
  total_count: number | null
}

type QueryParams = {
  search: string
  minRating: number
  delivery: DirectoryDeliveryFilter
  sortBy: DirectorySortMode
  pageSize: number
}

type QueryResult = {
  rows: DirectoryMerchant[]
  totalCount: number
}

type UseMerchantDirectorySearchResult = {
  rows: DirectoryMerchant[]
  totalCount: number
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
}

const CACHE_TTL_MS = 45000
const requestCache = new Map<string, { expiresAt: number; payload: QueryResult }>()

function cacheKey(params: QueryParams, page: number): string {
  return [
    params.search.trim().toLowerCase(),
    params.minRating,
    params.delivery,
    params.sortBy,
    params.pageSize,
    page,
  ].join('|')
}

function clampConversion(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0
  if (value > 1) return 1
  return value
}

function mapRow(row: DirectorySearchRow): DirectoryMerchant {
  const avgRating = Number(row.avg_rating ?? 0)
  const ratingCount = Number(row.rating_count ?? 0)
  const activeOffers = Number(row.active_offers ?? 0)
  const conversion = clampConversion(Number(row.avg_offer_conversion_rate ?? 0))
  const score = Number(row.performance_score ?? 0)

  const badges: DirectoryMerchant['badges'] = []
  if (conversion >= 0.35 && activeOffers >= 2) badges.push('Top conversion')
  if (avgRating >= 4.5 && ratingCount >= 3) badges.push('Mieux note')
  if (activeOffers >= 1 && Number(row.transactions_30d ?? 0) <= 8) badges.push('Nouveau')

  return {
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    address: row.address,
    city: row.city,
    avgRating,
    ratingCount,
    activeOffers,
    transactions30d: Number(row.transactions_30d ?? 0),
    avgOfferConversionRate: conversion,
    performanceScore: Math.max(0, Math.round(score)),
    badges,
  }
}

async function fetchDirectoryPage(params: QueryParams, page: number): Promise<QueryResult> {
  const key = cacheKey(params, page)
  const now = Date.now()
  const cached = requestCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.payload
  }

  const offset = (page - 1) * params.pageSize
  const { data, error } = await supabase.rpc('directory_search', {
    p_search: params.search.trim() || null,
    p_min_rating: params.minRating,
    p_delivery: params.delivery,
    p_sort_by: params.sortBy,
    p_limit: params.pageSize,
    p_offset: offset,
  })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as DirectorySearchRow[]
  const mapped = rows.map(mapRow)
  const totalCount = rows.length > 0 ? Number(rows[0].total_count ?? mapped.length) : 0

  const payload = { rows: mapped, totalCount }
  requestCache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    payload,
  })

  return payload
}

export function useMerchantDirectorySearch(params: QueryParams): UseMerchantDirectorySearchResult {
  const [rows, setRows] = useState<DirectoryMerchant[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const requestIdRef = useRef(0)

  const hasMore = rows.length < totalCount

  const loadPage = useCallback(async (targetPage: number, append: boolean) => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await fetchDirectoryPage(params, targetPage)
      if (requestId !== requestIdRef.current) return

      setRows((prev) => (append ? [...prev, ...result.rows] : result.rows))
      setTotalCount(result.totalCount)
      setPage(targetPage)
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) return
      setError(caughtError instanceof Error ? caughtError.message : 'Impossible de charger l annuaire.')
      if (!append) {
        setRows([])
        setTotalCount(0)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [params])

  useEffect(() => {
    void loadPage(1, false)
  }, [loadPage])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    await loadPage(page + 1, true)
  }, [hasMore, loadPage, loading, page])

  return useMemo(
    () => ({ rows, totalCount, loading, error, hasMore, loadMore }),
    [rows, totalCount, loading, error, hasMore, loadMore],
  )
}
