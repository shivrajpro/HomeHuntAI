import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bath, BedDouble, Heart, MapPin, Maximize, Scale, ShieldCheck } from 'lucide-react'

import { cn, formatINR } from '@/lib/utils'
import { useCompare } from '@/features/properties/compare-context'
import { useShortlist } from '@/features/properties/shortlist-context'
import {
  pricePerSqft,
  type Property,
} from '@/features/properties/types'

/** A single insight chip, e.g. "Walkable 82". Only shown when the score is strong. */
function InsightChip({ label, score }: { label: string; score: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
      {label}
      <span className="text-primary">{score}</span>
    </span>
  )
}

/**
 * Pick up to two of the strongest AI insights for a listing so the card leads
 * with what the place is actually good at rather than a wall of scores.
 */
function topInsights(property: Property): { label: string; score: number }[] {
  const { aiInsights } = property
  const entries: { label: string; score: number }[] = [
    { label: 'Walkable', score: aiInsights.walkability },
    { label: 'Family', score: aiInsights.familyScore },
    { label: 'Investment', score: aiInsights.investmentScore },
    { label: 'Commute', score: aiInsights.commuteScore },
    { label: 'Safe', score: aiInsights.safetyScore },
    { label: 'Green', score: aiInsights.greenScore },
  ]
  return entries
    .filter((e) => e.score >= 75)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
}

export function PropertyCard({ property }: { property: Property }) {
  const isRent = property.listingType === 'Rent'
  const insights = topInsights(property)
  const { isSelected, toggle, canAdd, compareType } = useCompare()
  const selected = isSelected(property.id)
  const addable = canAdd(property.listingType)
  const { isSaved, toggle: toggleShortlist } = useShortlist()
  const saved = isSaved(property.id)

  return (
    <motion.article
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
      }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-colors hover:border-primary/40 focus-within:border-primary/40"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-muted">
        <img
          src={property.images[0]}
          alt={property.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span
          className={cn(
            'absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur',
            isRent
              ? 'bg-warning/85 text-background'
              : 'bg-primary/85 text-primary-foreground',
          )}
        >
          {property.listingType}
        </span>
        {property.reraApproved && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/85 px-2.5 py-1 text-xs font-medium text-background backdrop-blur">
            <ShieldCheck className="size-3" />
            RERA
          </span>
        )}

        <button
          type="button"
          onClick={() => toggleShortlist(property.id)}
          aria-pressed={saved}
          title={saved ? 'Remove from shortlist' : 'Save to shortlist'}
          className={cn(
            'absolute bottom-2 left-2 z-20 grid size-7 place-items-center rounded-full shadow-sm backdrop-blur transition-colors',
            saved
              ? 'bg-primary text-primary-foreground'
              : 'bg-background/85 text-foreground hover:bg-background',
          )}
        >
          <Heart className={cn('size-3.5', saved && 'fill-current')} />
        </button>

        <button
          type="button"
          onClick={() => toggle(property.id, property.listingType)}
          disabled={!selected && !addable}
          aria-pressed={selected}
          title={
            selected
              ? 'Remove from comparison'
              : !addable
                ? 'You can compare up to 3 homes at a time'
                : compareType && compareType !== property.listingType
                  ? `Start a new comparison of ${property.listingType} homes`
                  : 'Add to comparison'
          }
          className={cn(
            'absolute bottom-2 right-2 z-20 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            selected
              ? 'bg-primary text-primary-foreground'
              : 'bg-background/85 text-foreground hover:bg-background',
          )}
        >
          <Scale className="size-3" />
          {selected ? 'Comparing' : 'Compare'}
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold tracking-tight">
            {formatINR(property.price)}
            {isRent && (
              <span className="text-sm font-normal text-muted-foreground">
                {' '}
                /mo
              </span>
            )}
          </p>
          <p className="shrink-0 text-xs text-muted-foreground">
            ₹{new Intl.NumberFormat('en-IN').format(pricePerSqft(property))}/sqft
          </p>
        </div>

        <h3 className="mt-1 line-clamp-1 font-medium tracking-tight">
          {property.title}
        </h3>

        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="line-clamp-1">
            {property.subLocality}, {property.city}
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {property.propertyType !== 'Plot' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="size-4" />
                {property.bhk} BHK
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Bath className="size-4" />
                {property.bathrooms}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Maximize className="size-4" />
            {new Intl.NumberFormat('en-IN').format(
              property.superBuiltupAreaSqft,
            )}{' '}
            sqft
          </span>
        </div>

        {insights.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {insights.map((i) => (
              <InsightChip key={i.label} label={i.label} score={i.score} />
            ))}
          </div>
        )}

        <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
          {property.propertyType} · {property.projectName}
        </p>
      </div>

      <Link
        to={`/property/${property.id}`}
        aria-label={property.title}
        className="absolute inset-0 z-10 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />
    </motion.article>
  )
}
