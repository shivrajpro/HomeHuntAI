import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Brain, Check, ChevronDown, Loader2 } from 'lucide-react'

import type { NestorTraceEvent } from '@/features/nestor/reasoning'
import { cn } from '@/lib/utils'

/** A single step in the reasoning timeline — spinner while active, check when done. */
function TraceRow({ event, last }: { event: NestorTraceEvent; last: boolean }) {
  const active = event.status === 'active'
  return (
    <li className="relative flex gap-2.5 pl-0.5">
      {/* Rail: the connecting line + the status node. */}
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full',
            active ? 'bg-primary/10 text-primary' : 'bg-success/15 text-success',
          )}
        >
          {active ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </span>
        {!last && <span className="w-px flex-1 bg-border/70" />}
      </div>
      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-2.5')}>
        <p
          className={cn(
            'text-xs font-medium tracking-tight',
            active ? 'text-foreground' : 'text-foreground/90',
          )}
        >
          {event.label}
        </p>
        {event.detail && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {event.detail}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * "Nestor's thinking" — the live reasoning trace. Streams the real pipeline
 * (scope → intent → catalogue scan → filter → shortlist → reasoning →
 * validation) as it runs, so the recommendation reads as the outcome of
 * visible work rather than a black box. While `live`, it stays expanded and
 * shows a spinner; once the turn is done it collapses into a thin, replayable
 * disclosure — collapsed by default so it never competes with the picks.
 */
export function NestorThinking({
  steps,
  live = false,
}: {
  steps: NestorTraceEvent[]
  live?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (steps.length === 0) return null

  const expanded = live || open
  const done = steps.filter((s) => s.status === 'done').length

  const header = (
    <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Brain className="size-3.5" />
      </span>
      <span className="text-xs font-medium tracking-tight">Nestor's thinking</span>
      {live ? (
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          reasoning…
        </span>
      ) : (
        <>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {done} step{done === 1 ? '' : 's'}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </>
      )}
    </div>
  )

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      {live ? (
        header
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full outline-none"
        >
          {header}
        </button>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={live ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ol className="px-3 pb-3">
              {steps.map((event, i) => (
                <TraceRow
                  key={event.step}
                  event={event}
                  last={i === steps.length - 1}
                />
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
