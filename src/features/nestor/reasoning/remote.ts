import { supabase } from '@/lib/supabase'
import {
  pricePerSqft,
  type ListingType,
  type Property,
  type PropertyInsights,
  type PropertyType,
  type Region,
} from '@/features/properties/types'

import type { NestorIntent } from './types'

/**
 * The Gemini reasoning call: the deterministic pipeline narrows the catalogue
 * to a shortlist, then the `nestor-reason` Edge Function has Gemini do the
 * actual deciding — which homes, in what order, with what fit and what
 * explanation — grounded in the full listing data (highlights, amenities,
 * nearby landmarks). Every id Gemini returns is validated against the
 * candidates we sent, so it can never invent a home.
 */

/** How many deterministically shortlisted homes Gemini gets to choose from. */
export const REASONING_CANDIDATE_COUNT = 12

/**
 * The slice of a listing Gemini reasons over — rich enough to ground
 * specific, factual explanations (landmarks with distances, amenities,
 * price-per-sqft value) while staying compact enough that a full shortlist
 * fits comfortably in one prompt.
 */
interface ReasoningCandidate {
  id: string
  title: string
  locality: string
  city: string
  region: Region
  propertyType: PropertyType
  listingType: ListingType
  bhk: number
  bathrooms: number
  priceINR: number
  pricePerSqftINR: number
  superBuiltupAreaSqft: number
  furnishing: string
  ageOfPropertyYears: number
  reraApproved: boolean
  localityScores: PropertyInsights
  highlights: string[]
  amenities: string[]
  nearby: {
    type: string
    name: string
    distanceKm: number
    travelTimeMinutes?: number
  }[]
}

function toReasoningCandidate(p: Property): ReasoningCandidate {
  return {
    id: p.id,
    title: p.title,
    locality: `${p.subLocality}, ${p.locality}`,
    city: p.city,
    region: p.region,
    propertyType: p.propertyType,
    listingType: p.listingType,
    bhk: p.bhk,
    bathrooms: p.bathrooms,
    priceINR: p.price,
    pricePerSqftINR: pricePerSqft(p),
    superBuiltupAreaSqft: p.superBuiltupAreaSqft,
    furnishing: p.furnishing,
    ageOfPropertyYears: p.ageOfPropertyYears,
    reraApproved: p.reraApproved,
    localityScores: p.aiInsights,
    highlights: p.highlights.slice(0, 4),
    amenities: p.amenities.slice(0, 6),
    nearby: p.nearby.slice(0, 5).map((n) => ({
      type: n.type,
      name: n.name,
      distanceKm: n.distanceKm,
      ...(n.travelTimeMinutes != null
        ? { travelTimeMinutes: n.travelTimeMinutes }
        : {}),
    })),
  }
}

/** What `nestor-reason` returns once its own id/shape validation has passed. */
export interface RemoteReasoning {
  summary: string
  picks: {
    id: string
    fit: number
    strengths: string[]
    tradeoff: string
    confidenceBasis: string
  }[]
}

/**
 * Ask the `nestor-reason` Edge Function (Gemini) to pick, rank and explain
 * from the hydrated candidate shortlist. Returns `null` on any failure —
 * network error, the function's rate limit, or output that failed its
 * validation — so `answerFor` can fall back to the deterministic ranking.
 */
export async function reasonRemote(
  intent: NestorIntent,
  candidates: Property[],
  context: {
    refined: boolean
    relaxed: string[]
    totalMatched: number
    topN: number
  },
): Promise<RemoteReasoning | null> {
  try {
    const { data, error } = await supabase.functions.invoke<RemoteReasoning>(
      'nestor-reason',
      {
        body: {
          brief: intent.rawText,
          intent: {
            listingType: intent.listingType,
            region: intent.region,
            maxPrice: intent.maxPrice,
            minBhk: intent.minBhk,
            propertyType: intent.propertyType,
            excludedPropertyTypes: intent.excludedPropertyTypes,
            priorities: intent.priorities,
            lifestyleTags: intent.lifestyleTags,
          },
          candidates: candidates.map(toReasoningCandidate),
          context: {
            refined: context.refined,
            relaxed: context.relaxed,
            usedDefaultPriorities: intent.usedDefaultPriorities,
            totalMatched: context.totalMatched,
            topN: context.topN,
          },
        },
      },
    )
    if (
      error ||
      !data?.summary ||
      !Array.isArray(data.picks) ||
      data.picks.length === 0
    ) {
      return null
    }
    return data
  } catch {
    return null
  }
}
