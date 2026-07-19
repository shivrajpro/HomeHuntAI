import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { filtersToParams } from '@/features/properties/filter-params'
import {
  bhksFromParams,
  EMPTY_FILTER_FORM,
  formFromParams,
  PRICE_OPTIONS,
  PROPERTY_TYPES,
  REGIONS,
  toFilters,
  type FilterForm,
} from '@/features/properties/filter-form'
import { cn, formatINR } from '@/lib/utils'
import type {
  ListingType,
  PropertyFilters,
  PropertyType,
  Region,
} from '@/features/properties/types'

import { BhkMultiSelect } from './bhk-multi-select'
import { selectClass } from './listbox'
import { SelectMenu } from './select-menu'

/**
 * The Explore search-and-filter bar. The URL is the source of truth for the
 * current search (shareable, survives a refresh): the form seeds once from
 * the params — either a Nestor hand-off or a shared Explore link — and every
 * change is pushed upward as typed `PropertyFilters` and written back to the
 * URL. Form model and option catalogues live in `filter-form.ts`; the custom
 * dropdowns in `select-menu.tsx` / `bhk-multi-select.tsx`.
 */
export function FilterBar({
  onChange,
}: {
  onChange: (filters: PropertyFilters) => void
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Seed once from the URL — either a Nestor hand-off or a refreshed/shared
  // Explore link — then keep writing back to it below so the URL stays the
  // source of truth for the current search (shareable, survives a refresh).
  const [initialForm] = useState(() => formFromParams(searchParams))
  const [selectedBhks, setSelectedBhks] = useState<number[]>(() =>
    bhksFromParams(searchParams),
  )

  const { register, watch, reset, setValue } = useForm<FilterForm>({
    defaultValues: initialForm,
  })

  // A handed-off budget may not be one of the presets — surface it as an extra
  // option so the select can show the value the user actually asked for.
  const initialMaxPrice = initialForm.maxPrice ? Number(initialForm.maxPrice) : null
  const priceOptions =
    initialMaxPrice != null && !PRICE_OPTIONS.some((p) => p.value === initialMaxPrice)
      ? [...PRICE_OPTIONS, { value: initialMaxPrice, label: formatINR(initialMaxPrice) }].sort(
          (a, b) => a.value - b.value,
        )
      : PRICE_OPTIONS

  // Push typed filters upward and sync them to the URL whenever any field
  // changes (debounced for search) — makes the search shareable and lets it
  // survive a refresh. `replace` so filter tweaks don't spam browser history.
  const values = watch()
  useEffect(() => {
    const timer = setTimeout(() => {
      const filters = toFilters(values, selectedBhks)
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
    values.maxPrice,
    selectedBhks,
  ])

  const hasActive =
    Object.entries(values).some(
      ([key, v]) => v !== EMPTY_FILTER_FORM[key as keyof FilterForm],
    ) || selectedBhks.length > 0

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            {...register('search')}
            type="text"
            aria-label="Search society name, locality, BHK, or apartment/villa"
            placeholder="Search society name, locality, BHK, or apartment/villa…"
            className={cn(selectClass, 'w-full pl-9', values.search && 'pr-9')}
          />
          {values.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() =>
                setValue('search', '', { shouldDirty: true, shouldTouch: true })
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap">
          <SelectMenu
            ariaLabel="Buy or Rent"
            value={values.listingType}
            onChange={(v) =>
              setValue('listingType', v as ListingType, {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            options={[
              { value: 'Buy', label: 'Buy' },
              { value: 'Rent', label: 'Rent' },
            ]}
          />

          <SelectMenu
            ariaLabel="City"
            value={values.region}
            onChange={(v) =>
              setValue('region', v as '' | Region, {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            options={[
              { value: '', label: 'Any city' },
              ...REGIONS.map((r) => ({ value: r, label: r })),
            ]}
          />

          <SelectMenu
            ariaLabel="Property type"
            value={values.propertyType}
            onChange={(v) =>
              setValue('propertyType', v as '' | PropertyType, {
                shouldDirty: true,
                shouldTouch: true,
              })
            }
            options={[
              { value: '', label: 'Any type' },
              ...PROPERTY_TYPES.map((t) => ({ value: t, label: t })),
            ]}
          />

          <BhkMultiSelect selected={selectedBhks} onChange={setSelectedBhks} />

          <SelectMenu
            ariaLabel="Maximum price"
            value={values.maxPrice}
            onChange={(v) =>
              setValue('maxPrice', v, { shouldDirty: true, shouldTouch: true })
            }
            options={[
              { value: '', label: 'Max price' },
              ...priceOptions.map((p) => ({
                value: String(p.value),
                label: p.label,
              })),
            ]}
          />

          {hasActive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset(EMPTY_FILTER_FORM)
                setSelectedBhks([])
              }}
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
