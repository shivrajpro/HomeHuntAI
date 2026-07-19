import {
  Bath,
  BedDouble,
  Building2,
  CalendarClock,
  Car,
  Compass,
  Maximize,
  Sofa,
} from 'lucide-react'

import type { Property } from '@/features/properties/types'

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

/** The key-specs grid: configuration, area, furnishing, parking, facing, floor, age. */
export function PropertySpecs({ property }: { property: Property }) {
  return (
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
  )
}
