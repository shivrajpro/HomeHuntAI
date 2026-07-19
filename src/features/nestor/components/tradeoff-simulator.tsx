import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react'

import {
  buildBudgetRange,
  buildSimSliders,
  defaultWeights,
  simulateRanking,
} from '@/features/nestor/trade-off'
import type { NestorIntent } from '@/features/nestor/reasoning'
import type { Property } from '@/features/properties/types'
import { cn, formatINR } from '@/lib/utils'

import { fitTone } from './fit-tones'

/** A single re-rankable home row in the simulator, with its live rank movement. */
function SimHomeRow({
  property,
  fit,
  rank,
  move,
  isPick,
}: {
  property: Property
  fit: number
  rank: number
  /** Places moved vs. the default ranking — positive is up, negative is down. */
  move: number
  isPick: boolean
}) {
  return (
    <motion.div
      layout
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-background p-2"
    >
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground">
        {rank}
      </span>
      <img
        src={property.images[0]}
        alt={property.title}
        loading="lazy"
        className="size-10 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="line-clamp-1 text-xs font-medium tracking-tight">
            {property.title}
          </p>
          {isPick && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
              Top pick
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
          {formatINR(property.price)}
          {property.listingType === 'Rent' && '/mo'} · {property.subLocality},{' '}
          {property.city}
        </p>
      </div>
      {move !== 0 && (
        <span
          className={cn(
            'flex shrink-0 items-center gap-0.5 text-[11px] font-medium tabular-nums',
            move > 0 ? 'text-success' : 'text-warning',
          )}
        >
          {move > 0 ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )}
          {Math.abs(move)}
        </span>
      )}
      <span
        className={cn(
          'w-14 shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
          fitTone(fit),
        )}
      >
        {fit}% fit
      </span>
    </motion.div>
  )
}

/** A labelled 0–100 importance slider for one simulator dimension. */
function WeightSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-medium tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} importance`}
        className="h-1.5 w-full cursor-pointer accent-primary"
      />
    </label>
  )
}

/**
 * Trade-off simulator — the "what if" sandbox. Because shortlisting is
 * deterministic, the user can drag the budget ceiling and per-priority
 * importance sliders and watch the pool re-score and re-rank *instantly*, fully
 * offline (no Gemini call). It re-ranks the same hydrated shortlist Nestor
 * already reasoned over, so a change can promote a candidate above the current
 * top picks — the arrows show each home's live movement against the starting
 * order. All scoring lives in `trade-off.ts`; this is just its controls.
 */
export function TradeoffSimulator({
  pool,
  intent,
  pickIds,
}: {
  pool: Property[]
  intent: NestorIntent
  pickIds: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const sliders = useMemo(() => buildSimSliders(intent), [intent])
  const budgetRange = useMemo(() => buildBudgetRange(intent, pool), [intent, pool])
  const defaults = useMemo(() => defaultWeights(sliders), [sliders])

  const [weights, setWeights] = useState<Record<string, number>>(defaults)
  const [budget, setBudget] = useState(budgetRange.base)

  // The starting order (defaults + base budget), so each row can show how far
  // the current settings have moved it.
  const baseRankById = useMemo(() => {
    const baseline = simulateRanking(pool, budgetRange.base, defaults)
    return new Map(baseline.map((h, i) => [h.property.id, i]))
  }, [pool, budgetRange.base, defaults])

  const ranked = useMemo(
    () => simulateRanking(pool, budget, weights),
    [pool, budget, weights],
  )

  const dirty =
    budget !== budgetRange.base ||
    sliders.some((s) => weights[s.key] !== s.defaultWeight)

  const budgetDelta = budget - budgetRange.base

  function reset() {
    setBudget(budgetRange.base)
    setWeights(defaults)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left outline-none"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <SlidersHorizontal className="size-3.5" />
        </span>
        <span className="text-xs font-medium tracking-tight">
          Trade-off simulator
        </span>
        <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
          What-if · instant, offline
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
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
            <div className="space-y-3 px-3 pb-3">
              <p className="text-[11px] text-muted-foreground">
                Adjust your max budget or how much each factor counts — the
                shortlist re-ranks live, no AI call.
              </p>

              {/* Control 1 — the budget *amount*: the most you'd spend. */}
              <div className="rounded-lg bg-background/60 p-2.5">
                <div className="mb-0.5 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-foreground">
                    Max budget
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {formatINR(budget)}
                    </span>
                    {budgetDelta !== 0 && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-px text-[10px] font-medium tabular-nums',
                          budgetDelta > 0
                            ? 'bg-success/15 text-success'
                            : 'bg-warning/15 text-warning',
                        )}
                      >
                        {budgetDelta > 0 ? '+' : '−'}
                        {formatINR(Math.abs(budgetDelta))}
                      </span>
                    )}
                  </span>
                </div>
                <p className="mb-2 text-[10px] leading-snug text-muted-foreground">
                  The most you'd spend. Homes score on how comfortably they fit
                  under it.
                </p>
                <input
                  type="range"
                  min={budgetRange.min}
                  max={budgetRange.max}
                  step={budgetRange.step}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  aria-label="Max budget"
                  className="h-1.5 w-full cursor-pointer accent-primary"
                />
              </div>

              {/* Control 2 — the factor *weights*: how much each one counts. */}
              <div className="rounded-lg bg-background/60 p-2.5">
                <p className="text-[11px] font-medium text-foreground">
                  What matters most
                </p>
                <p className="mb-2.5 text-[10px] leading-snug text-muted-foreground">
                  How much each factor counts toward the fit score — including
                  affordability (price vs. your max budget).
                </p>
                <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
                  {sliders.map((s) => (
                    <WeightSlider
                      key={s.key}
                      label={s.label}
                      value={weights[s.key] ?? 0}
                      onChange={(v) => setWeights((w) => ({ ...w, [s.key]: v }))}
                    />
                  ))}
                </div>
              </div>

              {dirty && (
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary outline-none"
                >
                  <RotateCcw className="size-3" />
                  Reset sliders
                </button>
              )}

              {/* The live re-ranked pool. */}
              <div className="space-y-1.5">
                {ranked.slice(0, 6).map((h, i) => {
                  const baseRank = baseRankById.get(h.property.id) ?? i
                  return (
                    <SimHomeRow
                      key={h.property.id}
                      property={h.property}
                      fit={h.fit}
                      rank={i + 1}
                      move={baseRank - i}
                      isPick={pickIds.has(h.property.id)}
                    />
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
