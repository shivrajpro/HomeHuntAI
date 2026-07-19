import { Heart, Mail, Phone, Scale } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCompare } from '@/features/properties/compare-context'
import { useShortlist } from '@/features/properties/shortlist-context'
import { pricePerSqft, type Property } from '@/features/properties/types'
import { cn, formatINR } from '@/lib/utils'

/**
 * The sticky sidebar card: price (with per-sqft, deposit and maintenance),
 * agent contact actions, and the compare / shortlist toggles.
 */
export function PropertyContactCard({ property }: { property: Property }) {
  const { isSelected, toggle, canAdd, compareType } = useCompare()
  const { isSaved, toggle: toggleShortlist } = useShortlist()
  const isRent = property.listingType === 'Rent'

  return (
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
  )
}
