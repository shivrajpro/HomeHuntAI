import { paramsToFilters } from '@/features/properties/filter-params'
import type {
  ListingType,
  PropertyFilters,
  PropertyType,
  Region,
} from '@/features/properties/types'

/**
 * The Explore filter bar's form model: the raw string-based form shape, its
 * option catalogues, and the translations between it, the URL params and the
 * typed `PropertyFilters` the queries consume.
 */

/**
 * The raw form shape — every field is a string ('' means "any"). BHK lives
 * outside the form as its own `number[]` state, since it's an exact-match
 * multiselect rather than a single string value.
 */
export interface FilterForm {
  search: string
  region: '' | Region
  listingType: '' | ListingType
  propertyType: '' | PropertyType
  maxPrice: '' | string
}

export const EMPTY_FILTER_FORM: FilterForm = {
  search: '',
  region: '',
  listingType: 'Buy',
  propertyType: '',
  maxPrice: '',
}

export const REGIONS: Region[] = ['Bangalore', 'Hyderabad', 'Delhi NCR', 'Pune']

export const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Villa',
  'Independent House',
  'Plot',
  'Builder Floor',
]

export const BHK_OPTIONS = [1, 2, 3, 4, 5]

/** Max-price buckets in ₹ — spans both sale (Cr) and rent (K/month) ranges. */
export const PRICE_OPTIONS = [
  { value: 25_000, label: '₹25K' },
  { value: 50_000, label: '₹50K' },
  { value: 1_00_000, label: '₹1L' },
  { value: 50_00_000, label: '₹50L' },
  { value: 1_00_00_000, label: '₹1 Cr' },
  { value: 2_00_00_000, label: '₹2 Cr' },
  { value: 5_00_00_000, label: '₹5 Cr' },
]

/** Seed the string-based form from URL params (Nestor → Explore hand-off). */
export function formFromParams(params: URLSearchParams): FilterForm {
  const f = paramsToFilters(params)
  return {
    search: f.search ?? '',
    region: f.region ?? '',
    listingType: f.listingType ?? 'Buy',
    propertyType: f.propertyType ?? '',
    maxPrice: f.maxPrice != null ? String(f.maxPrice) : '',
  }
}

/**
 * Seed the BHK multiselect from URL params. Exact `bhks` are used as-is; a
 * Nestor hand-off's `minBhk` ("3+ BHK") is expanded to every option at or
 * above it so the exact-match selector reflects the same intent.
 */
export function bhksFromParams(params: URLSearchParams): number[] {
  const f = paramsToFilters(params)
  if (f.bhks && f.bhks.length > 0) return f.bhks
  if (f.minBhk != null) return BHK_OPTIONS.filter((b) => b >= f.minBhk!)
  return []
}

/** Translate the string-based form + BHK selection into typed, sparse `PropertyFilters`. */
export function toFilters(form: FilterForm, bhks: number[]): PropertyFilters {
  const filters: PropertyFilters = {}
  if (form.search.trim()) filters.search = form.search.trim()
  if (form.region) filters.region = form.region
  if (form.listingType) filters.listingType = form.listingType
  if (form.propertyType) filters.propertyType = form.propertyType
  if (bhks.length > 0) filters.bhks = [...bhks].sort((a, b) => a - b)
  if (form.maxPrice) filters.maxPrice = Number(form.maxPrice)
  return filters
}
