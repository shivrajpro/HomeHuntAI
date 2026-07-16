import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, Scale } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { PropertyCard } from '@/features/properties/components/property-card'
import { usePropertiesByIds } from '@/features/properties/queries'
import { useShortlist } from '@/features/properties/shortlist-context'

/** Placeholder cards while shortlisted listings load. */
function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="aspect-4/3 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border/60 py-20 text-center">
      <div className="max-w-sm space-y-3">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
          <Heart className="size-6" />
        </div>
        <h3 className="font-medium tracking-tight">Your shortlist is empty</h3>
        <p className="text-sm text-muted-foreground">
          Tap the heart on any home in Explore, or on a listing page, to save
          it here for later.
        </p>
        <Button asChild>
          <Link to="/explore">Browse homes</Link>
        </Button>
      </div>
    </div>
  )
}

export function ShortlistPage() {
  const { ids } = useShortlist()
  const { data: properties, isLoading } = usePropertiesByIds(ids)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your shortlist
        </h1>
        <p className="mt-1 text-muted-foreground">
          {ids.length === 0
            ? 'Homes you save show up here.'
            : `${ids.length} home${ids.length === 1 ? '' : 's'} saved. Tap Compare on any two or three to weigh them side by side.`}
        </p>
      </div>

      {ids.length === 0 ? (
        <EmptyState />
      ) : isLoading || !properties ? (
        <LoadingGrid />
      ) : (
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
      )}

      {properties && properties.length >= 2 && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Scale className="size-4 shrink-0" />
          Select 2–3 with the Compare button to see them side by side.
        </p>
      )}
    </div>
  )
}
