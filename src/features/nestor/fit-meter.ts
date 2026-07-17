import { lifestyleScore } from '@/features/properties/comparison'
import type { Property } from '@/features/properties/types'
import type { NestorIntent } from '@/features/nestor/reasoning'

/**
 * The per-recommendation "visual fit meter" — Overall Fit % (already computed
 * as `RankedPick.fit`) plus a breakdown of Budget, Commute, Lifestyle, Family,
 * and Investment. Reuses the same `aiInsights` and `lifestyleScore` the
 * comparison engine uses, rather than a second scoring pass — only Budget is
 * new, since it has to be read against the brief's price ceiling rather than
 * an absolute locality score.
 */

export interface FitMeterBar {
  key: string
  label: string
  score: number
}

/**
 * How well a home's price sits against the brief's budget. No ceiling means
 * budget wasn't a constraint, so it's a non-factor (100). Within budget scores
 * 80–100 (more headroom scores higher); over budget falls off sharply.
 */
function budgetFitScore(property: Property, maxPrice?: number): number {
  if (maxPrice == null) return 100
  const ratio = property.price / maxPrice
  if (ratio <= 1) return Math.round(100 - ratio * 20)
  return Math.max(0, Math.round(80 - (ratio - 1) * 100))
}

export function buildFitMeter(
  property: Property,
  intent: NestorIntent,
): FitMeterBar[] {
  return [
    { key: 'budget', label: 'Budget', score: budgetFitScore(property, intent.maxPrice) },
    { key: 'commute', label: 'Commute', score: property.aiInsights.commuteScore },
    { key: 'lifestyle', label: 'Lifestyle', score: lifestyleScore(property) },
    { key: 'family', label: 'Family', score: property.aiInsights.familyScore },
    {
      key: 'investment',
      label: 'Investment',
      score: property.aiInsights.investmentScore,
    },
  ]
}
