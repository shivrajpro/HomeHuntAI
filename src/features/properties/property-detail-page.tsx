import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  CalendarClock,
  Car,
  Compass,
  Heart,
  Mail,
  MapPin,
  Maximize,
  Phone,
  Scale,
  ShieldCheck,
  Sofa,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScoreBar } from '@/components/ui/score-bar'
import { cn, formatINR } from '@/lib/utils'
import { useCompare } from '@/features/properties/compare-context'
import { useShortlist } from '@/features/properties/shortlist-context'
import { useProperty } from '@/features/properties/queries'
import { pricePerSqft, type Property } from '@/features/properties/types'
import { useDocumentTitle } from '@/lib/use-document-title'

const INSIGHT_LABELS: Record<keyof Property['aiInsights'], string> = {
  walkability: 'Walkability',
  familyScore: 'Family friendly',
  investmentScore: 'Investment',
  commuteScore: 'Commute',
  safetyScore: 'Safety',
  nightlifeScore: 'Nightlife',
  greenScore: 'Green cover',
}

function SpecItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BedDouble
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
      <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function Gallery({ property }: { property: Property }) {
  const [active, setActive] = useState(0)
  return (
    <div className="space-y-3">
      <div className="relative aspect-16/10 overflow-hidden rounded-2xl bg-muted">
        <img
          src={property.images[active]}
          alt={property.title}
          className="size-full object-cover"
        />
        <span
          className={cn(
            'absolute left-4 top-4 rounded-full px-3 py-1 text-sm font-medium backdrop-blur',
            property.listingType === 'Rent'
              ? 'bg-warning/85 text-background'
              : 'bg-primary/85 text-primary-foreground',
          )}
        >
          {property.listingType}
        </span>
      </div>
      {property.images.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {property.images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1} of ${property.images.length}`}
              aria-pressed={i === active}
              className={cn(
                'aspect-4/3 overflow-hidden rounded-lg border-2 transition-colors',
                i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
              )}
            >
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="aspect-16/10 animate-pulse rounded-2xl bg-muted" />
      <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

export function PropertyDetailPage() {
  const { id = '' } = useParams()
  const { data: property, isLoading, isError } = useProperty(id)
  const { isSelected, toggle, canAdd, compareType } = useCompare()
  const { isSaved, toggle: toggleShortlist } = useShortlist()

  useDocumentTitle(
    property
      ? `${property.title} · HomeHunt AI`
      : isLoading
        ? 'HomeHunt AI'
        : 'Listing not found · HomeHunt AI',
  )

  if (isLoading) return <DetailSkeleton />

  if (isError || !property) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Listing not found
          </h1>
          <p className="mx-auto max-w-sm text-muted-foreground">
            This home may have been taken down, or the link is incorrect.
          </p>
          <Button asChild>
            <Link to="/explore">Back to Explore</Link>
          </Button>
        </div>
      </div>
    )
  }

  const isRent = property.listingType === 'Rent'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-8"
    >
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/explore">
          <ArrowLeft className="size-4" />
          Back to Explore
        </Link>
      </Button>

      <Gallery property={property} />

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        {/* Main column */}
        <div className="space-y-8">
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {property.propertyType}
              </span>
              {property.listingType === 'Buy' && property.reraApproved && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-medium text-success">
                  <ShieldCheck className="size-3" />
                  RERA approved
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {property.title}
            </h1>
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              {property.address}
            </p>
          </header>

          {/* Key specs */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {property.propertyType !== 'Plot' && (
              <>
                <SpecItem icon={BedDouble} label="Configuration" value={`${property.bhk} BHK`} />
                <SpecItem icon={Bath} label="Bathrooms" value={String(property.bathrooms)} />
              </>
            )}
            <SpecItem
              icon={Maximize}
              label="Super built-up"
              value={`${new Intl.NumberFormat('en-IN').format(property.superBuiltupAreaSqft)} sqft`}
            />
            <SpecItem icon={Sofa} label="Furnishing" value={property.furnishing} />
            <SpecItem icon={Car} label="Parking" value={property.parking} />
            <SpecItem icon={Compass} label="Facing" value={property.facing} />
            <SpecItem
              icon={Building2}
              label="Floor"
              value={`${property.floor} of ${property.totalFloors}`}
            />
            <SpecItem
              icon={CalendarClock}
              label="Age"
              value={
                property.ageOfPropertyYears === 0
                  ? 'New / Under construction'
                  : `${property.ageOfPropertyYears} yr`
              }
            />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-medium tracking-tight">About this home</h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              {property.description}
            </p>
            {property.highlights.length > 0 && (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {property.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {property.amenities.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium tracking-tight">Amenities</h2>
              <div className="flex flex-wrap gap-2">
                {property.amenities.map((a) => (
                  <span
                    key={a}
                    className="rounded-full border border-border/60 bg-card px-3 py-1 text-sm text-muted-foreground"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {property.nearby.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-medium tracking-tight">What&apos;s nearby</h2>
              <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card">
                {property.nearby.map((n) => (
                  <div
                    key={`${n.type}-${n.name}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{n.name}</p>
                      <p className="text-xs text-muted-foreground">{n.type}</p>
                    </div>
                    <div className="shrink-0 text-right text-muted-foreground">
                      <p>{n.distanceKm} km</p>
                      {n.travelTimeMinutes != null && (
                        <p className="text-xs">{n.travelTimeMinutes} min</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <p className="text-2xl font-semibold tracking-tight">
              {formatINR(property.price)}
              {isRent && (
                <span className="text-base font-normal text-muted-foreground"> /mo</span>
              )}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ₹{new Intl.NumberFormat('en-IN').format(pricePerSqft(property))}/sqft
              {isRent && property.deposit != null && (
                <> · {formatINR(property.deposit)} deposit</>
              )}
            </p>
            {property.maintenancePerMonth > 0 && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {formatINR(property.maintenancePerMonth)}/mo maintenance
              </p>
            )}

            <div className="mt-4 border-t border-border/60 pt-4">
              <p className="text-sm font-medium">{property.contact.name}</p>
              <p className="text-xs text-muted-foreground">
                {property.builderName} · {property.projectName}
              </p>
              <div className="mt-3 grid gap-2">
                <Button asChild>
                  <a href={`tel:${property.contact.phone}`}>
                    <Phone className="size-4" />
                    {property.contact.phone}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`mailto:${property.contact.email}`}>
                    <Mail className="size-4" />
                    Email agent
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggle(property.id, property.listingType)}
                  disabled={
                    !isSelected(property.id) && !canAdd(property.listingType)
                  }
                  title={
                    isSelected(property.id) ||
                    !compareType ||
                    compareType === property.listingType
                      ? undefined
                      : `Start a new comparison of ${property.listingType} homes`
                  }
                  className={cn(
                    isSelected(property.id) && 'border-primary/40 text-primary',
                  )}
                >
                  <Scale className="size-4" />
                  {isSelected(property.id)
                    ? 'Remove from comparison'
                    : 'Add to comparison'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => toggleShortlist(property.id)}
                  className={cn(
                    isSaved(property.id) && 'border-primary/40 text-primary',
                  )}
                >
                  <Heart
                    className={cn('size-4', isSaved(property.id) && 'fill-current')}
                  />
                  {isSaved(property.id) ? 'Saved to shortlist' : 'Save to shortlist'}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-medium tracking-tight">Neighborhood intel</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              AI-scored for {property.subLocality}
            </p>
            <div className="mt-4 space-y-3">
              {(Object.keys(INSIGHT_LABELS) as (keyof Property['aiInsights'])[]).map(
                (key) => (
                  <ScoreBar
                    key={key}
                    label={INSIGHT_LABELS[key]}
                    score={property.aiInsights[key]}
                  />
                ),
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
