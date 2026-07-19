import {
  pricePerSqft,
  type PropertyRankingFields,
} from '@/features/properties/types'
import { formatINR, joinClauses } from '@/lib/utils'

import {
  ALL_DIMENSIONS,
  DECENT,
  DIMENSION_META,
  STRONG,
  type Dimension,
} from './dimensions'
import type { NestorIntent } from './types'

/**
 * The deterministic text builders: plain-language strengths, trade-offs,
 * confidence rationales and summaries for each pick. These double as the
 * offline fallback when the `nestor-reason` Edge Function is unavailable —
 * always qualitative, never a raw score, per the "no raw scores" invariant.
 */

/**
 * Plain-language phrasing for each locality dimension at two strength tiers, so
 * the picks read as "why this home" reasons rather than a table of numbers. The
 * underlying scores stay internal — we only surface a dimension when it's
 * genuinely strong.
 */
const STRENGTH_PHRASES: Record<Dimension, { high: string; good: string }> = {
  walkability: {
    high: 'Highly walkable — daily errands on foot',
    good: 'Walkable for everyday needs',
  },
  familyScore: {
    high: 'Excellent for families — schools and parks close by',
    good: 'Family-friendly surroundings',
  },
  investmentScore: {
    high: 'Strong investment potential and resale demand',
    good: 'Solid long-term value',
  },
  commuteScore: {
    high: 'Quick commute to work hubs and metro',
    good: 'Reasonable connectivity to work hubs',
  },
  safetyScore: {
    high: 'Very safe, secure neighbourhood',
    good: 'Safe, settled neighbourhood',
  },
  nightlifeScore: {
    high: 'Buzzing nightlife, cafés and dining',
    good: 'A lively social scene nearby',
  },
  greenScore: {
    high: 'Green, calm and peaceful setting',
    good: 'Pockets of greenery and open space',
  },
}

/**
 * The "Why this home" list. We lead with the dimensions the user actually
 * prioritised (why it fits *them*), then top up with the home's own standout
 * traits if that's thin — always qualitative, never a raw score.
 */
export function buildStrengths(
  p: PropertyRankingFields,
  priorities: Dimension[],
): string[] {
  const out: string[] = []
  const used = new Set<Dimension>()

  for (const dim of priorities) {
    const score = p.aiInsights[dim]
    if (score >= STRONG) out.push(STRENGTH_PHRASES[dim].high)
    else if (score >= DECENT) out.push(STRENGTH_PHRASES[dim].good)
    else continue
    used.add(dim)
    if (out.length >= 3) return out
  }

  if (out.length < 2) {
    const extras = ALL_DIMENSIONS.filter((d) => !used.has(d))
      .map((d) => ({ dim: d, score: p.aiInsights[d] }))
      .sort((a, b) => b.score - a.score)
    for (const { dim, score } of extras) {
      if (score < 78) break
      out.push(STRENGTH_PHRASES[dim].high)
      if (out.length >= 3) break
    }
  }

  // Never leave a pick with nothing to say — surface its single best trait.
  if (out.length === 0) {
    const best = ALL_DIMENSIONS.map((d) => ({ dim: d, score: p.aiInsights[d] })).sort(
      (a, b) => b.score - a.score,
    )[0]
    out.push(STRENGTH_PHRASES[best.dim].good)
  }
  return out
}

/**
 * The confidence rationale — *what the fit score is based on*. We ground it in
 * the user's top priority, budget headroom, and any caveats (priorities we had
 * to infer, filters we had to widen) so the percentage is never a bare number.
 */
export function buildConfidenceBasis(
  p: PropertyRankingFields,
  intent: NestorIntent,
  relaxed: string[],
): string {
  const parts: string[] = []

  const topDim = intent.priorities[0]
  const topScore = p.aiInsights[topDim]
  const topLabel = DIMENSION_META[topDim].label.toLowerCase()
  if (topScore >= STRONG) parts.push(`a strong match on your top priority (${topLabel})`)
  else if (topScore >= DECENT) parts.push(`a solid match on ${topLabel}`)
  else parts.push(`a fair match on ${topLabel}`)

  if (intent.maxPrice != null) {
    if (p.price <= intent.maxPrice * 0.85) parts.push('comfortable budget headroom')
    else if (p.price >= intent.maxPrice * 0.97) parts.push('a price near your ceiling')
  }

  if (intent.usedDefaultPriorities) parts.push('priorities we inferred for you')
  if (relaxed.length) parts.push(`filters we widened (${relaxed.join(', ')})`)

  return `Based on ${joinClauses(parts)}.`
}

export function buildTradeoff(p: PropertyRankingFields, intent: NestorIntent): string {
  const weakest = ALL_DIMENSIONS.map((dim) => ({
    label: DIMENSION_META[dim].label,
    score: p.aiInsights[dim],
  })).sort((a, b) => a.score - b.score)[0]

  if (weakest.score < 55) {
    return `${weakest.label} is on the weaker side here (${weakest.score}/100).`
  }
  if (intent.maxPrice != null && p.price >= intent.maxPrice * 0.9) {
    return `Sits near the top of your budget at ${formatINR(p.price)}.`
  }
  const perSqft = pricePerSqft(p)
  return `Well-rounded with no real weak spots — ₹${new Intl.NumberFormat(
    'en-IN',
  ).format(perSqft)}/sqft.`
}

export function buildSummary(
  intent: NestorIntent,
  relaxed: string[],
  refined: boolean,
): string {
  const action =
    intent.listingType === 'Rent'
      ? 'rentals'
      : intent.listingType === 'Buy'
        ? 'homes to buy'
        : 'homes'

  const where = intent.region ? `in ${intent.region}` : 'across our cities'

  const specs: string[] = []
  if (intent.maxPrice != null) specs.push(`under ${formatINR(intent.maxPrice)}`)
  if (intent.minBhk != null) specs.push(`${intent.minBhk}+ BHK`)
  if (intent.propertyType) specs.push(`${intent.propertyType.toLowerCase()}s`)
  const specText = specs.length ? `, ${specs.join(', ')}` : ''

  const priorityLabels = intent.priorities
    .slice(0, 3)
    .map((d) => DIMENSION_META[d].label.toLowerCase())
  const ranked = intent.usedDefaultPriorities
    ? `You didn't name specific priorities, so I balanced ${priorityLabels.join(
        ', ',
      )}.`
    : `I ranked them on ${priorityLabels.join(', ')}.`

  const lead = refined ? 'Updated your search. ' : ''
  const opener = `${lead}Here are the strongest ${action} ${where}${specText}. ${ranked}`

  if (relaxed.length) {
    return `${opener} I loosened the ${relaxed.join(
      ' and ',
    )} to surface enough good options.`
  }
  return opener
}
