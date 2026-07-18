import { budgetFitScore } from '@/features/nestor/fit-meter'
import { PRIORITY_OPTIONS, type NestorIntent, type PriorityDimension } from '@/features/nestor/reasoning'
import { pricePerSqft, type Property } from '@/features/properties/types'

/**
 * The trade-off simulator's scoring engine — a fully deterministic, offline
 * "what if" model over the shortlist Nestor already ranked. The user drags a
 * budget ceiling and per-priority importance sliders; every home in the pool is
 * re-scored and re-ranked instantly, with no Gemini call. It reuses the same
 * two ingredients the rest of Nestor scores on — the seven 0–100 locality
 * scores and the budget-fit curve from `fit-meter.ts` — so a home reads
 * consistently across the picks, the fit meter and here. This is intentionally
 * *not* the exact `fitScore`/Gemini pipeline: it's a live sandbox that makes the
 * ranking's sensitivity to priorities and budget tangible, not a re-run of the
 * real answer.
 */

/** A weight the simulator exposes: a locality dimension, or the budget pseudo-dimension. */
export type SimWeightKey = PriorityDimension | 'budget'

export interface SimSlider {
  key: SimWeightKey
  label: string
  /** Default importance (0–100) — budget gets a flat default, priorities decay by rank. */
  defaultWeight: number
}

/** The draggable budget ceiling: a base (the brief's, or the pool's dearest) and a range around it. */
export interface BudgetRange {
  base: number
  min: number
  max: number
  step: number
}

export interface SimRankedHome {
  property: Property
  /** 0–100 simulated fit under the current weights + budget ceiling. */
  fit: number
}

const labelFor = (dim: PriorityDimension): string =>
  PRIORITY_OPTIONS.find((o) => o.value === dim)?.label ?? dim

/**
 * The ordered sliders for a brief: budget first (it's the headline trade-off),
 * then the brief's priorities in importance order. Priority weights decay by
 * rank so the default simulator ranking mirrors the weighted fit the real
 * pipeline used (first priority counts most); budget gets a firm default when
 * the brief set a ceiling, a lighter one when it didn't.
 */
export function buildSimSliders(intent: NestorIntent): SimSlider[] {
  const n = intent.priorities.length
  const prioritySliders: SimSlider[] = intent.priorities.map((dim, i) => ({
    key: dim,
    label: labelFor(dim),
    // 100, then evenly down by rank — matches fitScore's (n - i) weighting.
    defaultWeight: n > 0 ? Math.round((100 * (n - i)) / n) : 0,
  }))
  return [
    // "Affordability", not "Budget" — this is the *importance* of staying cheap
    // relative to the other factors, a distinct control from the budget-ceiling
    // *amount* slider the UI shows separately.
    { key: 'budget', label: 'Affordability', defaultWeight: intent.maxPrice != null ? 70 : 40 },
    ...prioritySliders,
  ]
}

/** The default weight map (slider key → weight), used to seed state and reset. */
export function defaultWeights(sliders: SimSlider[]): Record<string, number> {
  return Object.fromEntries(sliders.map((s) => [s.key, s.defaultWeight]))
}

/** Round `value` to the nearest multiple of `step`. */
const roundTo = (value: number, step: number): number => Math.round(value / step) * step

/**
 * The budget slider's range: centred on the brief's ceiling (or, absent one,
 * the priciest home in the pool) and spanning ±50%, with a step sized to the
 * price magnitude so buy prices move in ₹5 L notches and rents in ₹1k ones.
 */
export function buildBudgetRange(intent: NestorIntent, pool: Property[]): BudgetRange {
  const base =
    intent.maxPrice ?? (pool.length ? Math.max(...pool.map((p) => p.price)) : 0)
  const step = base >= 1_00_00_000 ? 5_00_000 : base >= 5_00_000 ? 1_00_000 : 1_000
  return {
    base,
    min: Math.max(step, roundTo(base * 0.5, step)),
    max: roundTo(base * 1.5, step),
    step,
  }
}

function rawScore(p: Property, key: SimWeightKey, budget: number): number {
  return key === 'budget' ? budgetFitScore(p, budget) : p.aiInsights[key]
}

/**
 * Re-score and re-rank the pool for the current slider state. Fit is the
 * weight-normalised blend of each active dimension's 0–100 score (budget via
 * the budget-fit curve, everything else the locality score); ties break on the
 * cheaper price-per-sqft, exactly as the real ranking does.
 */
export function simulateRanking(
  pool: Property[],
  budget: number,
  weights: Record<string, number>,
): SimRankedHome[] {
  const keys = Object.keys(weights) as SimWeightKey[]
  return pool
    .map((property) => {
      let weighted = 0
      let total = 0
      for (const key of keys) {
        const w = weights[key]
        if (w <= 0) continue
        weighted += rawScore(property, key, budget) * w
        total += w
      }
      return { property, fit: total === 0 ? 0 : Math.round(weighted / total) }
    })
    .sort(
      (a, b) => b.fit - a.fit || pricePerSqft(a.property) - pricePerSqft(b.property),
    )
}
