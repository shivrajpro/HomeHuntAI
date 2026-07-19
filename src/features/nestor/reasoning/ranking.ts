import type { RankingPoolBounds } from '@/features/properties/api'
import {
  pricePerSqft,
  type PropertyRankingFields,
} from '@/features/properties/types'
import { formatINR } from '@/lib/utils'

import { DECENT, type Dimension } from './dimensions'
import type { NestorIntent } from './types'

/**
 * Deterministic candidate selection + ranking: hard constraints and a
 * weighted locality-score fit shortlist the strongest candidates from the
 * ranking pool, relaxing filters (cheapest constraint first) when matches are
 * thin. Near-misses ("why wasn't this recommended?") live here too — they're
 * constraint arithmetic with exact rupee amounts, not judgment, so they stay
 * deterministic even when Gemini does the picking.
 */

function matches(p: PropertyRankingFields, intent: NestorIntent): boolean {
  if (intent.listingType && p.listingType !== intent.listingType) return false
  if (intent.region && p.region !== intent.region) return false
  if (intent.maxPrice != null && p.price > intent.maxPrice) return false
  if (intent.minBhk != null && p.bhk < intent.minBhk) return false
  if (intent.propertyType && p.propertyType !== intent.propertyType)
    return false
  if (intent.excludedPropertyTypes.includes(p.propertyType)) return false
  return true
}

/** How much the budget relaxation widens the ceiling when matches are thin. */
const BUDGET_RELAX_FACTOR = 1.25

/** Loosen filters — cheapest constraint first — until we have enough homes. */
export function selectCandidates(
  intent: NestorIntent,
  pool: PropertyRankingFields[],
): {
  list: PropertyRankingFields[]
  relaxed: string[]
} {
  const relaxations: { label: string; apply: (i: NestorIntent) => NestorIntent }[] =
    [
      { label: 'property type', apply: (i) => ({ ...i, propertyType: undefined }) },
      { label: 'BHK count', apply: (i) => ({ ...i, minBhk: undefined }) },
      {
        label: 'budget',
        apply: (i) => ({
          ...i,
          maxPrice:
            i.maxPrice != null
              ? Math.round(i.maxPrice * BUDGET_RELAX_FACTOR)
              : undefined,
        }),
      },
      { label: 'city', apply: (i) => ({ ...i, region: undefined }) },
    ]

  let current = intent
  let list = pool.filter((p) => matches(p, current))
  const relaxed: string[] = []

  for (const r of relaxations) {
    if (list.length >= 3) break
    const next = r.apply(current)
    // Skip relaxations that change nothing (the constraint wasn't set).
    if (
      next.propertyType === current.propertyType &&
      next.minBhk === current.minBhk &&
      next.maxPrice === current.maxPrice &&
      next.region === current.region
    ) {
      continue
    }
    current = next
    list = pool.filter((p) => matches(p, current))
    relaxed.push(r.label)
  }

  return { list, relaxed }
}

export function fitScore(p: PropertyRankingFields, priorities: Dimension[]): number {
  const n = priorities.length
  let weighted = 0
  let total = 0
  priorities.forEach((dim, i) => {
    const weight = n - i
    weighted += p.aiInsights[dim] * weight
    total += weight
  })
  return Math.round(weighted / total)
}

/**
 * The flexible hard constraints a home breaks against the *original* brief, as
 * readable reasons. Listing type is deliberately excluded — a rental is never a
 * near-miss for a purchase — so this only covers budget, city, BHK and type.
 */
function describeFails(p: PropertyRankingFields, intent: NestorIntent): string[] {
  const fails: string[] = []
  if (intent.maxPrice != null && p.price > intent.maxPrice) {
    fails.push(`${formatINR(p.price - intent.maxPrice)} over your budget`)
  }
  if (intent.region && p.region !== intent.region) {
    fails.push(`In ${p.region}, outside ${intent.region}`)
  }
  if (intent.minBhk != null && p.bhk < intent.minBhk) {
    fails.push(`${p.bhk} BHK, under your ${intent.minBhk} BHK minimum`)
  }
  if (intent.excludedPropertyTypes.includes(p.propertyType)) {
    fails.push(`${p.propertyType} — you ruled those out`)
  } else if (intent.propertyType && p.propertyType !== intent.propertyType) {
    fails.push(`${p.propertyType}, not ${intent.propertyType}`)
  }
  return fails
}

/**
 * "Why wasn't this recommended?" — strong homes (high fit) that missed by
 * exactly one flexible constraint, so the user can decide whether to flex it.
 * We keep to single-constraint misses; anything failing on two counts isn't a
 * near-miss worth second-guessing.
 */
/** How far over budget still counts as a "near"-miss worth flagging (30%). */
const NEAR_BUDGET_CEILING = 1.3

export function findNearMisses(
  intent: NestorIntent,
  pool: PropertyRankingFields[],
  excludeIds: Set<string>,
): { property: PropertyRankingFields; fit: number; reason: string }[] {
  return pool
    .filter((p) => !excludeIds.has(p.id))
    .filter((p) => !intent.listingType || p.listingType === intent.listingType)
    // A home 3× the budget isn't a near-miss — only flag a modest overage.
    .filter(
      (p) =>
        intent.maxPrice == null ||
        p.price <= intent.maxPrice * NEAR_BUDGET_CEILING,
    )
    .filter((p) => !matches(p, intent))
    .map((p) => ({
      property: p,
      fit: fitScore(p, intent.priorities),
      fails: describeFails(p, intent),
    }))
    .filter((c) => c.fails.length === 1 && c.fit >= DECENT + 3)
    .sort(
      (a, b) =>
        b.fit - a.fit || pricePerSqft(a.property) - pricePerSqft(b.property),
    )
    .slice(0, 3)
    .map(({ property, fit, fails }) => ({ property, fit, reason: fails[0] }))
}

/**
 * The constraints the ranking pool can safely be narrowed by server-side —
 * everything Nestor can never widen past on its way to an answer. Listing type
 * qualifies because no relaxation touches it and a near-miss must share it. The
 * price ceiling is the loosest either path can reach: `selectCandidates` widens
 * the budget by at most `BUDGET_RELAX_FACTOR` (once, and only when matches are
 * thin), and `findNearMisses` looks no further than `NEAR_BUDGET_CEILING`.
 * Region, BHK and property type are all relaxable, so they stay client-side.
 */
export function poolBounds(intent: NestorIntent): RankingPoolBounds {
  const ceiling = Math.max(BUDGET_RELAX_FACTOR, NEAR_BUDGET_CEILING)
  return {
    listingType: intent.listingType,
    maxPrice:
      intent.maxPrice != null ? Math.ceil(intent.maxPrice * ceiling) : undefined,
  }
}
