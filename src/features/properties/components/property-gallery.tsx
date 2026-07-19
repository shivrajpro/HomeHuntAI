import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { Property } from '@/features/properties/types'

/** The detail page's photo gallery: hero image, listing-type badge, thumbnail strip. */
export function PropertyGallery({ property }: { property: Property }) {
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
