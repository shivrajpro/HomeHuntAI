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
  if (filters.bhks && filters.bhks.length > 0)
    params.set('bhk', filters.bhks.join(','))
  else if (filters.minBhk != null) params.set('minBhk', String(filters.minBhk))
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

  // Exact BHK selections (Explore multiselect), e.g. `bhk=1,2,3`.
  const bhkParam = params.get('bhk')
  if (bhkParam) {
    const bhks = Array.from(
      new Set(
        bhkParam
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isInteger(n) && n > 0),
      ),
    ).sort((a, b) => a - b)
    if (bhks.length > 0) filters.bhks = bhks
  }

  // Legacy / Nestor hand-off: a `>=` minimum. Ignored if exact `bhk` is present.
  const minBhk = Number(params.get('minBhk'))
  if (filters.bhks == null && Number.isFinite(minBhk) && minBhk > 0)
    filters.minBhk = minBhk

  const maxPrice = Number(params.get('maxPrice'))
  if (Number.isFinite(maxPrice) && maxPrice > 0) filters.maxPrice = maxPrice

  return filters
}
