import { formatINR, joinClauses } from '@/lib/utils'
import type { Property } from '@/features/properties/types'

/**
 * Deterministic side-by-side comparison for 2–3 homes — no backend, no LLM
 * call. Each home is scored 0–100 on six dimensions (budget is normalised
 * inversely: cheapest scores highest), a composite average picks the overall
 * winner, and a short reasoning paragraph explains why.
 */

export interface ComparisonRow {
  key: string
  label: string
  /** Formatted display value per property, same order as `properties`. */
  values: string[]
  /** 0–100 normalised score per property, used to find the winner. */
  scores: number[]
  /** Index into `properties`, or `null` when tied. */
  winnerIndex: number | null
}

export interface ComparisonResult {
  properties: Property[]
  rows: ComparisonRow[]
  /** 0–100 overall fit per property, equal-weighted across all rows. */
  compositeScores: number[]
  winnerIndex: number
  headline: string
  reasoning: string
  /** One line per non-winning property, explaining the gap. */
  runnerUpNotes: string[]
}

/** Reused by the Copilot's per-pick fit meter, not just this comparison. */
export function lifestyleScore(p: Property): number {
  const { walkability, nightlifeScore, greenScore } = p.aiInsights
  return Math.round((walkability + nightlifeScore + greenScore) / 3)
}

/** Cheapest scores 100, priciest scores 0, linear in between. */
function normalizeInverse(values: number[]): number[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (max === min) return values.map(() => 100)
  return values.map((v) => Math.round(100 - ((v - min) / (max - min)) * 100))
}

function argmax(values: number[]): number {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i
  }
  return best
}

function buildRow(
  key: string,
  label: string,
  values: string[],
  scores: number[],
): ComparisonRow {
  const max = Math.max(...scores)
  const winners = scores.filter((s) => s === max).length
  return {
    key,
    label,
    values,
    scores,
    winnerIndex: winners === 1 ? scores.indexOf(max) : null,
  }
}

export function buildComparison(properties: Property[]): ComparisonResult {
  const priceScores = normalizeInverse(properties.map((p) => p.price))
  const priceLabels = properties.map(
    (p) => formatINR(p.price) + (p.listingType === 'Rent' ? '/mo' : ''),
  )

  const commuteScores = properties.map((p) => p.aiInsights.commuteScore)
  const investmentScores = properties.map((p) => p.aiInsights.investmentScore)
  const familyScores = properties.map((p) => p.aiInsights.familyScore)
  const lifestyleScores = properties.map(lifestyleScore)
  const amenityCounts = properties.map((p) => p.amenities.length)
  const maxAmenities = Math.max(...amenityCounts, 1)
  const amenityScores = amenityCounts.map((c) => Math.round((c / maxAmenities) * 100))

  const rows: ComparisonRow[] = [
    buildRow('budget', 'Budget', priceLabels, priceScores),
    buildRow('commute', 'Commute', commuteScores.map((s) => `${s}/100`), commuteScores),
    buildRow(
      'investment',
      'Investment Potential',
      investmentScores.map((s) => `${s}/100`),
      investmentScores,
    ),
    buildRow(
      'family',
      'Family Friendliness',
      familyScores.map((s) => `${s}/100`),
      familyScores,
    ),
    buildRow(
      'lifestyle',
      'Lifestyle Fit',
      lifestyleScores.map((s) => `${s}/100`),
      lifestyleScores,
    ),
    buildRow(
      'amenities',
      'Amenities',
      amenityCounts.map((c) => `${c} amenities`),
      amenityScores,
    ),
  ]

  const compositeScores = properties.map((_, i) =>
    Math.round(rows.reduce((sum, row) => sum + row.scores[i], 0) / rows.length),
  )

  const winnerIndex = argmax(compositeScores)

  // Which categories each property led on, for the reasoning copy.
  const winsByIndex = rows.reduce<Record<number, string[]>>((acc, row) => {
    if (row.winnerIndex != null) {
      acc[row.winnerIndex] = [...(acc[row.winnerIndex] ?? []), row.label]
    }
    return acc
  }, {})

  const titleOf = (i: number) => properties[i].title
  const winnerWins = winsByIndex[winnerIndex] ?? []

  const headline = `${titleOf(winnerIndex)} is the strongest overall choice`
  const reasoning = winnerWins.length
    ? `It leads on ${joinClauses(winnerWins)}, giving it the best overall balance across budget, commute, investment, family fit, lifestyle and amenities.`
    : `It offers the most balanced profile across budget, commute, investment, family fit, lifestyle and amenities, even without leading any single category outright.`

  const runnerUpNotes = properties
    .map((_, i) => i)
    .filter((i) => i !== winnerIndex)
    .map((i) => {
      const gap = compositeScores[winnerIndex] - compositeScores[i]
      const wins = winsByIndex[i] ?? []
      const winNote = wins.length ? ` — ahead on ${joinClauses(wins)}` : ''
      return `${titleOf(i)} scores ${gap} point${gap === 1 ? '' : 's'} lower overall${winNote}.`
    })

  return {
    properties,
    rows,
    compositeScores,
    winnerIndex,
    headline,
    reasoning,
    runnerUpNotes,
  }
}
