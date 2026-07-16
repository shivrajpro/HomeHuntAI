import { formatINR } from '@/lib/utils'
import {
  PRIORITY_OPTIONS,
  type CopilotAnswer,
  type CopilotIntent,
  type PriorityDimension,
  type RankedPick,
} from '@/features/copilot/reasoning'

/**
 * Packages an already-computed `CopilotAnswer` into a premium "Decision
 * Report" — no new scoring, just structuring what the reasoning engine
 * already produced into: User Requirements, AI Understanding, Top
 * Recommendation, Strengths, Trade-offs, Alternative Options, Final
 * Recommendation.
 */
export interface DecisionReport {
  brief: string
  requirements: string[]
  understanding: string[]
  topPick?: RankedPick
  strengths: string[]
  tradeoffs: string[]
  alternatives: { pick: RankedPick; note: string }[]
  finalRecommendation: string
  totalConsidered: number
}

function priorityLabel(dim: PriorityDimension): string {
  return PRIORITY_OPTIONS.find((o) => o.value === dim)?.label ?? dim
}

function buildRequirements(intent: CopilotIntent): string[] {
  const out: string[] = []
  out.push(
    intent.listingType === 'Rent'
      ? 'Looking to rent'
      : intent.listingType === 'Buy'
        ? 'Looking to buy'
        : 'Open to buying or renting',
  )
  out.push(intent.region ? `City: ${intent.region}` : 'City: open to any of our markets')
  if (intent.maxPrice != null) {
    out.push(
      `Budget: up to ${formatINR(intent.maxPrice)}${intent.listingType === 'Rent' ? '/mo' : ''}`,
    )
  }
  if (intent.minBhk != null) out.push(`Configuration: ${intent.minBhk}+ BHK`)
  if (intent.propertyType) out.push(`Property type: ${intent.propertyType}`)
  if (intent.excludedPropertyTypes.length) {
    out.push(`Ruled out: ${intent.excludedPropertyTypes.join(', ')}`)
  }
  return out
}

function buildUnderstanding(intent: CopilotIntent, relaxedNote?: string): string[] {
  const out: string[] = []
  const labels = intent.priorities.map(priorityLabel)
  out.push(
    intent.usedDefaultPriorities
      ? `No priorities were named, so I balanced ${labels.join(', ')}.`
      : `Ranked priorities: ${labels.join(' > ')}.`,
  )
  if (intent.lifestyleTags.length) {
    out.push(`Read your lifestyle as: ${intent.lifestyleTags.join(', ')}.`)
  }
  if (relaxedNote) out.push(`Widened ${relaxedNote} to surface enough strong options.`)
  return out
}

function buildAlternativeNote(top: RankedPick, alt: RankedPick): string {
  const fitDiff = top.fit - alt.fit
  const priceDiff = alt.property.price - top.property.price
  const priceClause =
    priceDiff === 0
      ? 'the same price as the top pick'
      : priceDiff > 0
        ? `${formatINR(Math.abs(priceDiff))} more than the top pick`
        : `${formatINR(Math.abs(priceDiff))} less than the top pick`
  const closeness = fitDiff <= 3 ? 'A very close alternative' : `${fitDiff} points lower fit`
  return `${closeness} — ${priceClause}.`
}

function buildFinalRecommendation(
  top: RankedPick | undefined,
  intent: CopilotIntent,
): string {
  if (!top) {
    return "No home in our listings met your requirements closely enough to recommend — try widening your budget or city."
  }
  const location = `${top.property.subLocality}, ${top.property.city}`
  const price = formatINR(top.property.price) + (top.property.listingType === 'Rent' ? '/mo' : '')
  const leadStrength = top.strengths[0] ?? `it stands out on ${priorityLabel(intent.priorities[0]).toLowerCase()}`
  const basis = top.confidenceBasis.charAt(0).toLowerCase() + top.confidenceBasis.slice(1)
  return `${top.property.title} in ${location} is the top recommendation at ${price}. ${leadStrength}, and ${basis}`
}

export function buildDecisionReport(answer: CopilotAnswer): DecisionReport {
  const [topPick, ...alternativePicks] = answer.picks
  return {
    brief: answer.intent.rawText,
    requirements: buildRequirements(answer.intent),
    understanding: buildUnderstanding(answer.intent, answer.relaxedNote),
    topPick,
    strengths: topPick?.strengths ?? [],
    tradeoffs: topPick ? [topPick.tradeoff] : [],
    alternatives: topPick
      ? alternativePicks.map((pick) => ({
          pick,
          note: buildAlternativeNote(topPick, pick),
        }))
      : [],
    finalRecommendation: buildFinalRecommendation(topPick, answer.intent),
    totalConsidered: answer.totalMatched,
  }
}
