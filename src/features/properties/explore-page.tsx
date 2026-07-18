import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FilterBar } from '@/features/properties/components/filter-bar'
import { PropertyCard } from '@/features/properties/components/property-card'
import { useProperties } from '@/features/properties/queries'
import type { PropertyFilters } from '@/features/properties/types'
import { useDocumentTitle } from '@/lib/use-document-title'

/**
 * Rows fetched for the first page — small so the initial Explore load stays
 * fast rather than pulling the whole catalogue up front.
 */
const INITIAL_LIMIT = 36
/** Extra rows fetched each time the visitor asks for more. */
const LOAD_MORE_STEP = 24

/** Placeholder cards while the (mock) request is in flight. */
function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/60 bg-card"
        >
          <div className="aspect-4/3 animate-pulse bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
      <div className="max-w-sm space-y-2">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </div>
        <h3 className="font-medium tracking-tight">No homes match those filters</h3>
        <p className="text-sm text-muted-foreground">
          Try widening your price, city, or BHK — or clear the filters to see
          everything.
        </p>
      </div>
    </div>
  )
}

export function ExplorePage() {
  useDocumentTitle('Explore homes · HomeHunt AI')
  const [filters, setFilters] = useState<PropertyFilters>({})
  const [limit, setLimit] = useState(INITIAL_LIMIT)
  const { data, isLoading, isError } = useProperties(filters, limit)

  // Reset paging whenever the filters change so a new search starts small.
  useEffect(() => {
    setLimit(INITIAL_LIMIT)
  }, [filters])

  const properties = data?.properties
  const total = data?.total ?? 0
  const hasMore = properties ? properties.length < total : false
  // The result count is only meaningful once the visitor has narrowed things
  // down — showing "1,000 homes" over an unfiltered catalogue is just noise.
  // Buy/Rent (`listingType`) is always set, so it doesn't count as narrowing.
  const hasFilters = Object.keys(filters).some((key) => key !== 'listingType')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Explore homes
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isLoading || !properties
            ? 'Loading listings…'
            : hasFilters
              ? `${new Intl.NumberFormat('en-IN').format(total)} homes match your search`
              : 'Browse every home, or filter to narrow your search.'}
        </p>
      </div>

      <FilterBar onChange={setFilters} />

      {isError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Something went wrong loading listings. Please try again.
        </div>
      ) : isLoading || !properties ? (
        <LoadingGrid />
      ) : properties.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.03 } },
            }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {properties.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </motion.div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setLimit((l) => l + LOAD_MORE_STEP)}
              >
                Load more homes
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
