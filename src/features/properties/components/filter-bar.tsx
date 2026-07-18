import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { filtersToParams, paramsToFilters } from '@/features/properties/filter-params'
import { cn, formatINR } from '@/lib/utils'
import type {
  ListingType,
  PropertyFilters,
  PropertyType,
  Region,
} from '@/features/properties/types'

/**
 * The raw form shape — every field is a string ('' means "any"). BHK lives
 * outside the form as its own `number[]` state, since it's an exact-match
 * multiselect rather than a single string value.
 */
interface FilterForm {
  search: string
  region: '' | Region
  listingType: '' | ListingType
  propertyType: '' | PropertyType
  maxPrice: '' | string
}

const EMPTY: FilterForm = {
  search: '',
  region: '',
  listingType: 'Buy',
  propertyType: '',
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
const BHK_OPTIONS = [1, 2, 3, 4, 5]
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

/** Seed the string-based form from URL params (Nestor → Explore hand-off). */
function formFromParams(params: URLSearchParams): FilterForm {
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
function bhksFromParams(params: URLSearchParams): number[] {
  const f = paramsToFilters(params)
  if (f.bhks && f.bhks.length > 0) return f.bhks
  if (f.minBhk != null) return BHK_OPTIONS.filter((b) => b >= f.minBhk!)
  return []
}

/** Translate the string-based form + BHK selection into typed, sparse `PropertyFilters`. */
function toFilters(form: FilterForm, bhks: number[]): PropertyFilters {
  const filters: PropertyFilters = {}
  if (form.search.trim()) filters.search = form.search.trim()
  if (form.region) filters.region = form.region
  if (form.listingType) filters.listingType = form.listingType
  if (form.propertyType) filters.propertyType = form.propertyType
  if (bhks.length > 0) filters.bhks = [...bhks].sort((a, b) => a - b)
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
      ([key, v]) => v !== EMPTY[key as keyof FilterForm],
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
                reset(EMPTY)
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

interface SelectOption {
  value: string
  label: string
}

/**
 * Single-select dropdown styled to match {@link BhkMultiSelect} — a custom
 * popover rather than a native `<select>`, so the option menu carries the same
 * rounded rows, hover states, theme colors, and checkmark as the BHK picker
 * (native `<option>` menus can't be styled). An option whose `value` is ''
 * acts as the "any"/placeholder and shows muted trigger text when active.
 */
function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape so the popover behaves like a native menu.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const isPlaceholder = value === ''
  const label = options.find((o) => o.value === value)?.label ?? options[0]?.label

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(selectClass, 'flex w-full items-center justify-between gap-2')}
      >
        <span className={cn('truncate', isPlaceholder && 'text-muted-foreground')}>
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 min-w-40 rounded-md border border-border/60 bg-popover p-1 shadow-md"
        >
          {options.map((o) => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span>{o.label}</span>
                {isSelected && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Exact-match, multiselect BHK picker — "2 BHK" means exactly 2, not "2 or more". */
function BhkMultiSelect({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (next: number[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click or Escape so the popover behaves like a native menu.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function toggle(bhk: number) {
    onChange(
      selected.includes(bhk)
        ? selected.filter((b) => b !== bhk)
        : [...selected, bhk].sort((a, b) => a - b),
    )
  }

  const label =
    selected.length === 0
      ? 'Any BHK'
      : `${[...selected].sort((a, b) => a - b).join(', ')} BHK`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="BHK"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(selectClass, 'flex w-full items-center justify-between gap-2')}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
          {label}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute z-20 mt-1 min-w-40 rounded-md border border-border/60 bg-popover p-1 shadow-md"
        >
          {BHK_OPTIONS.map((b) => {
            const isSelected = selected.includes(b)
            return (
              <button
                key={b}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => toggle(b)}
                className="flex w-full items-center justify-between gap-3 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span>{b} BHK</span>
                {isSelected && <Check className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
