import { fetchPropertiesByIds } from '@/features/properties/api'
import { fetchRankingPool } from '@/features/properties/queries'
import { pricePerSqft, type Property } from '@/features/properties/types'

import { DEFAULT_PRIORITIES } from './dimensions'
import { deriveIntentAsync } from './intent'
import {
  buildConfidenceBasis,
  buildStrengths,
  buildSummary,
  buildTradeoff,
} from './narration'
import {
  findNearMisses,
  fitScore,
  poolBounds,
  selectCandidates,
} from './ranking'
import { REASONING_CANDIDATE_COUNT, reasonRemote } from './remote'
import type {
  NestorAnswer,
  NestorIntent,
  NestorTrace,
  RankedPick,
  RejectedPick,
} from './types'

/**
 * The full Nestor pipeline: brief → intent → deterministic shortlist →
 * Gemini-reasoned, explained picks — with each Gemini call degrading to its
 * local deterministic counterpart independently on any failure, so Nestor
 * always produces a defensible answer. Listings come from Supabase in two
 * stages: ranking scans a slim projection of the catalogue
 * (`PropertyRankingFields`), then only the shortlist sent to Gemini is
 * hydrated into full `Property` objects.
 */

const groupCount = (n: number) => new Intl.NumberFormat('en-IN').format(n)

/** Rank + explain the catalogue for an already-resolved intent. */
async function answerFor(
  rawIntent: NestorIntent,
  refined: boolean,
  topN: number,
  onTrace?: NestorTrace,
): Promise<NestorAnswer> {
  // An empty priority list would divide by zero in `fitScore`; fall back to the
  // balanced default (can happen if the user removes every priority chip).
  const intent: NestorIntent = rawIntent.priorities.length
    ? rawIntent
    : { ...rawIntent, priorities: DEFAULT_PRIORITIES, usedDefaultPriorities: true }

  onTrace?.({ step: 'catalogue', status: 'active', label: 'Scanning listings' })
  const pool = await fetchRankingPool(poolBounds(intent))
  onTrace?.({
    step: 'catalogue',
    status: 'done',
    label: 'Listings scanned',
    detail: `${groupCount(pool.length)} in range`,
  })

  onTrace?.({ step: 'filter', status: 'active', label: 'Applying your filters' })
  const { list, relaxed } = selectCandidates(intent, pool)
  onTrace?.({
    step: 'filter',
    status: 'done',
    label: relaxed.length ? 'Filtered (widened)' : 'Filtered to matches',
    detail: `${groupCount(list.length)} match${
      relaxed.length ? ` · loosened ${relaxed.join(', ')}` : ''
    }`,
  })

  const ranked = list
    .map((property) => ({
      property,
      fit: fitScore(property, intent.priorities),
    }))
    .sort((a, b) => {
      if (b.fit !== a.fit) return b.fit - a.fit
      // Tie-break on value: cheaper per-sqft wins.
      return pricePerSqft(a.property) - pricePerSqft(b.property)
    })

  // Hydrate the shortlist up front: Gemini needs the full listing detail to
  // reason with, and whichever homes it picks are then ready to render with
  // no second round trip.
  onTrace?.({ step: 'shortlist', status: 'active', label: 'Ranking by fit' })
  const shortlist = ranked.slice(0, Math.max(topN, REASONING_CANDIDATE_COUNT))
  const hydratedCandidates = await hydrate(shortlist.map((r) => r.property.id))
  const candidates = shortlist
    .map((r) => hydratedCandidates.get(r.property.id))
    .filter((p): p is Property => p != null)
  onTrace?.({
    step: 'shortlist',
    status: 'done',
    label: 'Ranked by fit',
    detail: `top ${candidates.length}`,
  })

  onTrace?.({ step: 'reason', status: 'active', label: 'Weighing the shortlist' })
  const remote =
    candidates.length > 0
      ? await reasonRemote(intent, candidates, {
          refined,
          relaxed,
          totalMatched: list.length,
          topN,
        })
      : null

  let picks: RankedPick[] = []
  let summary = ''
  let reasonedBy: 'gemini' | 'local' = 'local'
  if (remote) {
    picks = remote.picks
      .filter((p) => hydratedCandidates.has(p.id))
      .slice(0, topN)
      .map((p) => ({
        property: hydratedCandidates.get(p.id)!,
        fit: Math.min(100, Math.max(0, Math.round(p.fit))),
        strengths: p.strengths.slice(0, 4),
        tradeoff: p.tradeoff,
        confidenceBasis: p.confidenceBasis,
      }))
    // The UI and tests key off this exact lead on refined turns — guarantee
    // it rather than trusting the prompt to comply.
    summary =
      refined && !remote.summary.startsWith('Updated your search')
        ? `Updated your search. ${remote.summary}`
        : remote.summary
    reasonedBy = 'gemini'
  }
  if (picks.length === 0) {
    // Deterministic fallback: the weighted-fit top N with the local text
    // builders, so a Gemini outage degrades to the pre-Gemini behaviour.
    reasonedBy = 'local'
    picks = ranked.slice(0, topN).flatMap(({ property, fit }) => {
      const full = hydratedCandidates.get(property.id)
      if (!full) return []
      return [
        {
          property: full,
          fit,
          strengths: buildStrengths(full, intent.priorities),
          tradeoff: buildTradeoff(full, intent),
          confidenceBasis: buildConfidenceBasis(full, intent, relaxed),
        },
      ]
    })
    summary = buildSummary(intent, relaxed, refined)
  }
  onTrace?.({
    step: 'reason',
    status: 'done',
    label: reasonedBy === 'gemini' ? 'Reasoned by Gemini' : 'Reasoned offline',
    detail:
      reasonedBy === 'gemini'
        ? `Gemini · ${picks.length} pick${picks.length === 1 ? '' : 's'}`
        : `deterministic fallback · ${picks.length} pick${
            picks.length === 1 ? '' : 's'
          }`,
  })

  // Every returned id was validated against the shortlist we sent (in the
  // picks mapping above and again server-side), so no pick can be an invented
  // home — surface that guarantee as the closing step.
  onTrace?.({
    step: 'validate',
    status: 'done',
    label: 'Picks validated',
    detail: picks.length
      ? `${picks.length} grounded in real listings`
      : 'no match',
  })

  // Near-misses come after the final picks are known: Gemini may choose a
  // different top 3 than the deterministic ranking would, and a home can't be
  // both a pick and a "why wasn't this recommended" entry.
  const pickIds = new Set(picks.map((pick) => pick.property.id))
  const nearMisses = findNearMisses(intent, pool, pickIds)
  const hydratedMisses = await hydrate(nearMisses.map((r) => r.property.id))

  const rejected: RejectedPick[] = nearMisses.flatMap(({ property, fit, reason }) => {
    const full = hydratedMisses.get(property.id)
    return full ? [{ property: full, fit, reason }] : []
  })

  return {
    intent,
    summary,
    picks,
    rejected,
    totalMatched: list.length,
    refined,
    relaxedNote: relaxed.length ? relaxed.join(', ') : undefined,
    reasonedBy,
    // The shortlist we ranked, hydrated — the trade-off simulator re-ranks over
    // this pool client-side. Picks are always a subset of it.
    simulatorHomes: candidates,
  }
}

/** Full listings for the ids we're about to render, keyed by id. */
async function hydrate(ids: string[]): Promise<Map<string, Property>> {
  if (ids.length === 0) return new Map()
  const full = await fetchPropertiesByIds(ids)
  return new Map(full.map((p) => [p.id, p]))
}

/**
 * A redirect reply for a first message that isn't a home-search brief at all
 * (e.g. "how do I deploy this to Vercel?") — no picks, since ranking an empty
 * filter set against the whole catalogue is exactly the wrong behaviour that
 * prompted this. `intent` stays empty/default so it's harmless if carried
 * forward as `prevIntent` on the next, hopefully on-topic, turn.
 */
function offTopicAnswer(rawText: string): NestorAnswer {
  return {
    intent: {
      excludedPropertyTypes: [],
      priorities: DEFAULT_PRIORITIES,
      usedDefaultPriorities: true,
      lifestyleTags: [],
      rawText,
    },
    summary:
      "I'm Nestor — HomeHuntAI's home decision partner, focused on Bangalore, Hyderabad, Greater Delhi Area, and Pune. I help you discover real homes to buy or rent based on your city, budget and priorities.",
    picks: [],
    rejected: [],
    totalMatched: 0,
    refined: false,
    offTopic: true,
  }
}

/**
 * A short conversational reply for a follow-up that carried no recognisable
 * search signal at all — an acknowledgment ("ok thanks", "great, thank you")
 * or an off-topic aside mid-conversation. The previous intent is preserved
 * untouched (only `rawText` updates) so a later genuine refinement ("actually
 * make it cheaper") still builds on the real search, but this turn itself
 * doesn't re-render the same picks again — that was the bug: any zero-signal
 * follow-up silently re-showed the prior listings as if it were a fresh
 * answer.
 */
function noNewSignalAnswer(prevIntent: NestorIntent, rawText: string): NestorAnswer {
  return {
    intent: { ...prevIntent, rawText },
    summary:
      "Got it! Let me know if you'd like to refine this search — a different city, budget, BHK, or priority — or start a new one.",
    picks: [],
    rejected: [],
    totalMatched: 0,
    refined: false,
    noNewSignal: true,
  }
}

/**
 * Run the full pipeline: brief → intent → shortlist → Gemini-reasoned,
 * explained picks. Pass the previous turn's intent to refine it (multi-turn
 * memory) instead of starting from scratch. Intent parsing goes through
 * Gemini (`deriveIntentAsync`) and so does the ranking/explanation step
 * (`answerFor` → `reasonRemote`), each falling back to its local
 * deterministic counterpart independently if the call fails. A first message
 * with no home-search signal at all short-circuits to a redirect instead of
 * ranking the full, unfiltered catalogue (see `offTopicAnswer`); a follow-up
 * with no recognisable signal short-circuits to a short acknowledgment
 * instead of re-running the previous search (see `noNewSignalAnswer`).
 */
export async function runNestor(
  rawText: string,
  prevIntent?: NestorIntent,
  topN = 3,
  onTrace?: NestorTrace,
): Promise<NestorAnswer> {
  const { intent, refined, offTopic } = await deriveIntentAsync(
    rawText,
    prevIntent,
    onTrace,
  )
  if (offTopic && !prevIntent) return offTopicAnswer(rawText)
  if (prevIntent && !refined) return noNewSignalAnswer(prevIntent, rawText)
  return answerFor(intent, refined, topN, onTrace)
}

/**
 * Re-rank an existing intent after the user edits its priorities in the UI —
 * no re-parsing, just a fresh reasoning pass (Gemini, with the deterministic
 * fallback) against the updated priority order. The priority edit itself
 * doesn't change the intent's filters, so the ranking pool is the same query
 * the original turn already ran.
 */
export function rerankIntent(
  intent: NestorIntent,
  topN = 3,
  onTrace?: NestorTrace,
): Promise<NestorAnswer> {
  return answerFor(intent, true, topN, onTrace)
}
