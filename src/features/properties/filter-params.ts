import {
  listingTypeSchema,
  propertyTypeSchema,
  regionSchema,
  type PropertyFilters,
} from '@/features/properties/types'

/**
 * Serialise/parse `PropertyFilters` to and from URL search params. Used for the
 * Nestor → Explore hand-off (and a stepping stone toward URL-synced filters).
 * Parsing validates enums against the Zod schemas, so stray or stale params are
 * ignored rather than trusted.
 */

export function filtersToParams(filters: PropertyFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('q', filters.search)
  if (filters.region) params.set('region', filters.region)
  if (filters.listingType) params.set('listingType', filters.listingType)
  if (filters.propertyType) params.set('propertyType', filters.propertyType)
  if (filters.minBhk != null) params.set('minBhk', String(filters.minBhk))
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice))
  return params
}

export function paramsToFilters(params: URLSearchParams): PropertyFilters {
  const filters: PropertyFilters = {}

  const q = params.get('q')?.trim()
  if (q) filters.search = q

  const region = regionSchema.safeParse(params.get('region'))
  if (region.success) filters.region = region.data

  const listingType = listingTypeSchema.safeParse(params.get('listingType'))
  if (listingType.success) filters.listingType = listingType.data

  const propertyType = propertyTypeSchema.safeParse(params.get('propertyType'))
  if (propertyType.success) filters.propertyType = propertyType.data

  const minBhk = Number(params.get('minBhk'))
  if (Number.isFinite(minBhk) && minBhk > 0) filters.minBhk = minBhk

  const maxPrice = Number(params.get('maxPrice'))
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice

  return filters
}
