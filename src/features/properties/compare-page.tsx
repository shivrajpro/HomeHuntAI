import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Scale, Sparkles, Trophy, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn, formatINR } from '@/lib/utils'
import { MAX_COMPARE, useCompare } from '@/features/properties/compare-context'
import { buildComparison, type ComparisonRow } from '@/features/properties/comparison'
import { usePropertiesByIds } from '@/features/properties/queries'
import type { Property } from '@/features/properties/types'

/** Read + dedupe `?ids=a,b,c` from the URL, capped at the compare limit. */
function parseIds(params: URLSearchParams): string[] {
  const raw = params.get('ids')
  if (!raw) return []
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, MAX_COMPARE)
}

function PromptState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-center">
      <div className="max-w-sm space-y-4">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Scale className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">{body}</p>
        <Button asChild>
          <Link to="/explore">Browse homes</Link>
        </Button>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-4/3 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

function PropertyColumn({
  property,
  isWinner,
  onRemove,
}: {
  property: Property
  isWinner: boolean
  onRemove: () => void
}) {
  const isRent = property.listingType === 'Rent'
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden rounded-2xl border bg-card',
        isWinner ? 'border-primary/60 ring-1 ring-primary/30' : 'border-border/60',
      )}
    >
      {isWinner && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
          <Trophy className="size-3" />
          Best overall
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${property.title} from comparison`}
        className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>

      <Link to={`/property/${property.id}`} className="relative aspect-4/3 overflow-hidden bg-muted">
        <img src={property.images[0]} alt={property.title} className="size-full object-cover" />
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-lg font-semibold tracking-tight">
          {formatINR(property.price)}
          {isRent && <span className="text-sm font-normal text-muted-foreground"> /mo</span>}
        </p>
        <Link
          to={`/property/${property.id}`}
          className="line-clamp-1 font-medium tracking-tight hover:text-primary"
        >
          {property.title}
        </Link>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">
            {property.subLocality}, {property.city}
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {property.propertyType !== 'Plot' && `${property.bhk} BHK · `}
          {new Intl.NumberFormat('en-IN').format(property.superBuiltupAreaSqft)} sqft
        </p>
      </div>
    </div>
  )
}

function ComparisonRowView({ row, count }: { row: ComparisonRow; count: number }) {
  return (
    <div
      className="grid items-center gap-3 border-t border-border/60 py-3 first:border-t-0"
      style={{ gridTemplateColumns: `8rem repeat(${count}, 1fr)` }}
    >
      <p className="text-sm font-medium text-muted-foreground">{row.label}</p>
      {row.values.map((value, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-center text-sm',
            row.winnerIndex === i
              ? 'border-primary/50 bg-primary/10 font-semibold text-primary'
              : 'border-border/50 text-foreground',
          )}
        >
          {row.winnerIndex === i && <Trophy className="size-3.5 shrink-0" />}
          <span className="truncate">{value}</span>
        </div>
      ))}
    </div>
  )
}

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const ids = parseIds(searchParams)
  const { data: properties, isLoading } = usePropertiesByIds(ids)
  const { remove: removeFromCompare } = useCompare()

  if (ids.length < 2) {
    return (
      <PromptState
        title="Select homes to compare"
        body="Pick 2–3 homes from Explore or a listing page — a compare button appears once you've chosen them."
      />
    )
  }

  if (isLoading || !properties) return <LoadingState />

  if (properties.length < 2) {
    return (
      <PromptState
        title="Not enough homes to compare"
        body="One or more of these listings could not be found. Head back to Explore and pick again."
      />
    )
  }

  const comparison = buildComparison(properties)

  function handleRemove(id: string) {
    removeFromCompare(id)
    const next = ids.filter((v) => v !== id)
    setSearchParams(next.length ? { ids: next.join(',') } : {})
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Comparing {properties.length} homes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Weighed equally across budget, commute, investment, family fit, lifestyle and
          amenities.
        </p>
      </div>

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${properties.length}, minmax(0, 1fr))` }}
      >
        {properties.map((property, i) => (
          <PropertyColumn
            key={property.id}
            property={property}
            isWinner={i === comparison.winnerIndex}
            onRemove={() => handleRemove(property.id)}
          />
        ))}
      </div>

      <section className="space-y-1 rounded-2xl border border-border/60 bg-card p-5">
        <h2 className="text-lg font-medium tracking-tight">How they compare</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[36rem]">
            {comparison.rows.map((row) => (
              <ComparisonRowView key={row.key} row={row} count={properties.length} />
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          <Sparkles className="size-5 text-primary" />
          Overall Recommendation
        </h2>
        <p className="font-medium text-foreground">{comparison.headline}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{comparison.reasoning}</p>
        {comparison.runnerUpNotes.length > 0 && (
          <ul className="space-y-1 pt-1">
            {comparison.runnerUpNotes.map((note) => (
              <li key={note} className="text-sm text-muted-foreground">
                {note}
              </li>
            ))}
          </ul>
        )}
      </section>
    </motion.div>
  )
}
