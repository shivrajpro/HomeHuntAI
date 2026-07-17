import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { filtersToParams, paramsToFilters } from '@/features/properties/filter-params'
import { cn, formatINR } from '@/lib/utils'
import type {
  ListingType,
  PropertyFilters,
  PropertyType,
  Region,
} from '@/features/properties/types'

/** The raw form shape — every field is a string ('' means "any"). */
interface FilterForm {
  search: string
  region: '' | Region
  listingType: '' | ListingType
  propertyType: '' | PropertyType
  minBhk: '' | string
  maxPrice: '' | string
}

const EMPTY: FilterForm = {
  search: '',
  region: '',
  listingType: '',
  propertyType: '',
  minBhk: '',
  maxPrice: '',
}

const REGIONS: Region[] = ['Bangalore', 'Hyderabad', 'Delhi NCR', 'Pune']
const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Villa',
  'Independent House',
  'Plot',
  'Builder Floor',
]
const BHK_OPTIONS = [1, 2, 3, 4]
/** Max-price buckets in ₹ — spans both sale (Cr) and rent (K/month) ranges. */
const PRICE_OPTIONS = [
  { value: 25_000, label: '₹25K' },
  { value: 50_000, label: '₹50K' },
  { value: 1_00_000, label: '₹1L' },
  { value: 50_00_000, label: '₹50L' },
  { value: 1_00_00_000, label: '₹1 Cr' },
  { value: 2_00_00_000, label: '₹2 Cr' },
  { value: 5_00_00_000, label: '₹5 Cr' },
]

/** Seed the string-based form from URL params (the Copilot → Explore hand-off). */
function formFromParams(params: URLSearchParams): FilterForm {
  const f = paramsToFilters(params)
  return {
    search: f.search ?? '',
    region: f.region ?? '',
    listingType: f.listingType ?? '',
    propertyType: f.propertyType ?? '',
    minBhk: f.minBhk != null ? String(f.minBhk) : '',
    maxPrice: f.maxPrice != null ? String(f.maxPrice) : '',
  }
}

/** Translate the string-based form into typed, sparse `PropertyFilters`. */
function toFilters(form: FilterForm): PropertyFilters {
  const filters: PropertyFilters = {}
  if (form.search.trim()) filters.search = form.search.trim()
  if (form.region) filters.region = form.region
  if (form.listingType) filters.listingType = form.listingType
  if (form.propertyType) filters.propertyType = form.propertyType
  if (form.minBhk) filters.minBhk = Number(form.minBhk)
  if (form.maxPrice) filters.maxPrice = Number(form.maxPrice)
  return filters
}

const selectClass = cn(
  'h-10 rounded-md border border-input bg-background px-3 text-sm outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
)

export function FilterBar({
  onChange,
}: {
  onChange: (filters: PropertyFilters) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Seed once from the URL — either a Copilot hand-off or a refreshed/shared
  // Explore link — then keep writing back to it below so the URL stays the
  // source of truth for the current search (shareable, survives a refresh).
  const [initialForm] = useState(() => formFromParams(searchParams))

  const { register, watch, reset } = useForm<FilterForm>({
    defaultValues: initialForm,
  })

  // A handed-off budget/BHK may not be one of the presets — surface it as an
  // extra option so the select can show the value the user actually asked for.
  const initialMaxPrice = initialForm.maxPrice ? Number(initialForm.maxPrice) : null
  const priceOptions =
    initialMaxPrice != null && !PRICE_OPTIONS.some((p) => p.value === initialMaxPrice)
      ? [...PRICE_OPTIONS, { value: initialMaxPrice, label: formatINR(initialMaxPrice) }].sort(
          (a, b) => a.value - b.value,
        )
      : PRICE_OPTIONS

  const initialBhk = initialForm.minBhk ? Number(initialForm.minBhk) : null
  const bhkOptions =
    initialBhk != null && !BHK_OPTIONS.includes(initialBhk)
      ? [...BHK_OPTIONS, initialBhk].sort((a, b) => a - b)
      : BHK_OPTIONS

  // Push typed filters upward and sync them to the URL whenever any field
  // changes (debounced for search) — makes the search shareable and lets it
  // survive a refresh. `replace` so filter tweaks don't spam browser history.
  const values = watch()
  useEffect(() => {
    const timer = setTimeout(() => {
      const filters = toFilters(values)
      onChange(filters)
      setSearchParams(filtersToParams(filters), { replace: true })
    }, 200)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.search,
    values.region,
    values.listingType,
    values.propertyType,
    values.minBhk,
    values.maxPrice,
  ])

  const hasActive = Object.values(values).some((v) => v !== '')

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            {...register('search')}
            type="text"
            aria-label="Search locality, project, or vibe"
            placeholder="Search locality, project, or vibe…"
            className={cn(selectClass, 'w-full pl-9')}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap">
          <select {...register('listingType')} aria-label="Buy or Rent" className={selectClass}>
            <option value="">Buy / Rent</option>
            <option value="Buy">Buy</option>
            <option value="Rent">Rent</option>
          </select>

          <select {...register('region')} aria-label="City" className={selectClass}>
            <option value="">Any city</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select {...register('propertyType')} aria-label="Property type" className={selectClass}>
            <option value="">Any type</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select {...register('minBhk')} aria-label="Minimum BHK" className={selectClass}>
            <option value="">Any BHK</option>
            {bhkOptions.map((b) => (
              <option key={b} value={b}>
                {b}+ BHK
              </option>
            ))}
          </select>

          <select {...register('maxPrice')} aria-label="Maximum price" className={selectClass}>
            <option value="">Max price</option>
            {priceOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {hasActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => reset(EMPTY)}
              className="text-muted-foreground"
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
