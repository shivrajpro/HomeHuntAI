import { lifestyleScore } from '@/features/properties/comparison'
import type { Property } from '@/features/properties/types'
import type { NestorIntent } from '@/features/nestor/reasoning'
import { formatINR } from '@/lib/utils'

/**
 * The per-recommendation "visual fit meter" — Overall Fit % (already computed
 * as `RankedPick.fit`) plus a breakdown of Affordability, Commute, Lifestyle,
 * Family and Investment. Reuses the same `aiInsights` and `lifestyleScore` the
 * comparison engine uses, rather than a second scoring pass — only Affordability
 * is new, since it has to be read against the brief's price ceiling rather than
 * an absolute locality score.
 *
 * Each bar carries a plain-language `caption` (so a score reads as *meaning*,
 * not a bare 0–100) and a `prioritized` flag (so the breakdown surfaces the
 * factors the user actually asked for, first). Raw scores stay internal — the
 * UI renders a qualitative tier, per the Nestor "no raw scores" invariant.
 */

export interface FitMeterBar {
  key: string
  label: string
  /** 0–100, kept internal — drives the bar length and tier, never shown bare. */
  score: number
  /** One line of plain language explaining what this score reflects for this home. */
  caption: string
  /** True when this factor is one the user explicitly asked to optimise for. */
  prioritized: boolean
}

/** A qualitative band for a 0–100 score, so users read fit as words, not numbers. */
export type FitTier = 'Excellent' | 'Strong' | 'Good' | 'Fair' | 'Limited'

export function fitTier(score: number): FitTier {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Strong'
  if (score >= 55) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Limited'
}

/**
 * How well a home's price sits against the brief's budget. No ceiling means
 * budget wasn't a constraint, so it's a non-factor (100). Within budget scores
 * 80–100 (more headroom scores higher); over budget falls off sharply. Exported
 * because the trade-off simulator (`trade-off.ts`) re-scores budget fit against
 * a *user-dragged* ceiling with this exact curve, so a home reads the same in
 * the fit meter and the simulator.
 */
export function budgetFitScore(property: Property, maxPrice?: number): number {
  if (maxPrice == null) return 100
  const ratio = property.price / maxPrice
  if (ratio <= 1) return Math.round(100 - ratio * 20)
  return Math.max(0, Math.round(80 - (ratio - 1) * 100))
}

/** The concrete "why this affordability score" line — real rupees, not a number. */
function affordabilityCaption(property: Property, maxPrice?: number): string {
  if (maxPrice == null) return 'No budget cap set — not a limiting factor'
  const gap = maxPrice - property.price
  if (gap >= 0) {
    return gap === 0
      ? 'Right at your budget'
      : `${formatINR(gap)} under your ${formatINR(maxPrice)} budget`
  }
  return `${formatINR(-gap)} over your ${formatINR(maxPrice)} budget`
}

export function buildFitMeter(
  property: Property,
  intent: NestorIntent,
): FitMeterBar[] {
  const p = intent.priorities
  const bars: FitMeterBar[] = [
    {
      key: 'affordability',
      label: 'Affordability',
      score: budgetFitScore(property, intent.maxPrice),
      caption: affordabilityCaption(property, intent.maxPrice),
      prioritized: intent.maxPrice != null,
    },
    {
      key: 'commute',
      label: 'Commute',
      score: property.aiInsights.commuteScore,
      caption: 'Access to metro, offices and connectivity',
      prioritized: p.includes('commuteScore'),
    },
    {
      key: 'lifestyle',
      label: 'Lifestyle',
      score: lifestyleScore(property),
      caption: 'Walkability, nightlife and green space nearby',
      prioritized: p.some((d) =>
        (['walkability', 'nightlifeScore', 'greenScore'] as const).includes(
          d as 'walkability' | 'nightlifeScore' | 'greenScore',
        ),
      ),
    },
    {
      key: 'family',
      label: 'Family life',
      score: property.aiInsights.familyScore,
      caption: 'Schools, safety and family amenities',
      prioritized: p.includes('familyScore') || p.includes('safetyScore'),
    },
    // Appreciation/resale is a buyer concern; skip it for rentals.
    ...(property.listingType === 'Rent'
      ? []
      : [
          {
            key: 'investment' as const,
            label: 'Investment',
            score: property.aiInsights.investmentScore,
            caption: 'Appreciation and rental-return potential',
            prioritized: p.includes('investmentScore'),
          },
        ]),
  ]

  // Surface the factors the user actually asked for, first — a stable sort so
  // the fixed order is preserved within each group.
  return bars
    .map((bar, i) => ({ bar, i }))
    .sort((a, b) =>
      a.bar.prioritized === b.bar.prioritized
        ? a.i - b.i
        : a.bar.prioritized
          ? -1
          : 1,
    )
    .map(({ bar }) => bar)
}
