import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X } from 'lucide-react'

import type { RejectedPick } from '@/features/nestor/reasoning'

/**
 * "Why wasn't this recommended?" — a disclosure listing strong homes that
 * missed by a single hard constraint, each with the reason. Helps the user
 * decide whether a constraint is worth flexing, rather than trusting a black box.
 */
export function RejectedSection({ rejected }: { rejected: RejectedPick[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left outline-none"
      >
        <span className="text-xs font-medium tracking-tight">
          Why weren't these recommended?
          <span className="ml-1 text-muted-foreground">({rejected.length})</span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-1 text-[11px] text-muted-foreground">
              Strong on fit, but each misses one thing you asked for.
            </p>
            <div className="space-y-1.5 px-3 pb-3">
              {rejected.map((r) => (
                <Link
                  key={r.property.id}
                  to={`/property/${r.property.id}`}
                  className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-background p-2 outline-none transition-colors hover:border-primary/40 focus-visible:border-primary/40"
                >
                  <img
                    src={r.property.images[0]}
                    alt={r.property.title}
                    loading="lazy"
                    className="size-11 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-xs font-medium tracking-tight">
                        {r.property.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {r.fit}% fit
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning">
                      <X className="size-3 shrink-0" />
                      <span className="line-clamp-1">{r.reason}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
