import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import { Scale, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MAX_COMPARE, useCompare } from '@/features/properties/compare-context'
import { usePropertiesByIds } from '@/features/properties/queries'

/**
 * Floating tray that tracks the site-wide compare selection. Appears the
 * moment a home is added, everywhere in the app, so a user can browse
 * Explore, add a couple of homes, then jump straight to `/compare`.
 *
 * Hidden on `/compare` itself: the tray is a shortcut *to* that page, so it's
 * redundant there — and being `fixed`, it would otherwise overlap the bottom of
 * the comparison (the recommendation card) with no reserved space.
 */
export function CompareTray() {
  const { selectedIds, remove, clear } = useCompare()
  const { data: properties } = usePropertiesByIds(selectedIds)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const onComparePage = pathname === '/compare'

  const canCompare = selectedIds.length >= 2

  return (
    <AnimatePresence>
      {selectedIds.length > 0 && !onComparePage && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-border/60 bg-card/95 p-2.5 shadow-lg backdrop-blur-xl sm:bottom-4 sm:gap-4 sm:p-3"
        >
          <div className="flex items-center gap-2">
            {(properties ?? []).map((property) => (
              <div
                key={property.id}
                className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted"
              >
                <img
                  src={property.images[0]}
                  alt={property.title}
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => remove(property.id)}
                  aria-label={`Remove ${property.title} from comparison`}
                  className="absolute right-0 top-0 grid size-4 place-items-center rounded-bl bg-background/90 text-foreground"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}
            {Array.from({ length: MAX_COMPARE - selectedIds.length }).map((_, i) => (
              <div
                key={i}
                className="grid size-11 shrink-0 place-items-center rounded-lg border border-dashed border-border/60 text-[11px] text-muted-foreground"
              >
                +
              </div>
            ))}
          </div>

          <p className="hidden whitespace-nowrap text-sm text-muted-foreground sm:block">
            {selectedIds.length} of {MAX_COMPARE} selected
          </p>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-muted-foreground"
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!canCompare}
              onClick={() => navigate(`/compare?ids=${selectedIds.join(',')}`)}
            >
              <Scale className="size-4" />
              Compare
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
