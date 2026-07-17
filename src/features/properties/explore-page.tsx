import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FilterBar } from '@/features/properties/components/filter-bar'
import { PropertyCard } from '@/features/properties/components/property-card'
import { useProperties } from '@/features/properties/queries'
import type { PropertyFilters } from '@/features/properties/types'
import { useDocumentTitle } from '@/lib/use-document-title'

/** Cards rendered per "page" — keeps the DOM light with 2,000 seed listings. */
const PAGE_SIZE = 24

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const { data: properties, isLoading, isError } = useProperties(filters)

  // Reset paging whenever the result set changes so a new search starts at top.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filters])

  const visible = properties?.slice(0, visibleCount) ?? []
  const hasMore = properties ? visibleCount < properties.length : false

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Explore homes
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isLoading || !properties
            ? 'Loading listings…'
            : `${new Intl.NumberFormat('en-IN').format(properties.length)} homes match your search`}
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
            {visible.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </motion.div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
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
