import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { NeighborhoodIntel } from '@/features/properties/components/neighborhood-intel'
import { PropertyContactCard } from '@/features/properties/components/property-contact-card'
import { PropertyGallery } from '@/features/properties/components/property-gallery'
import { PropertySpecs } from '@/features/properties/components/property-specs'
import { useProperty } from '@/features/properties/queries'
import { useDocumentTitle } from '@/lib/use-document-title'

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

      <PropertyGallery property={property} />

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

          <PropertySpecs property={property} />

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
          <PropertyContactCard property={property} />
          <NeighborhoodIntel property={property} />
        </div>
      </div>
    </motion.div>
  )
}
