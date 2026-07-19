import { supabase } from '@/lib/supabase'
import type {
  ListingType,
  PropertyFilters,
  PropertyType,
  Region,
} from '@/features/properties/types'
import { formatINR } from '@/lib/utils'

import {
  ALL_DIMENSIONS,
  DEFAULT_PRIORITIES,
  DIMENSION_META,
  LIFE_STAGES,
  type Dimension,
} from './dimensions'
import type { NestorIntent, NestorTrace } from './types'

/**
 * Intent parsing: turning a free-text brief into a structured `NestorIntent`.
 * Parsing is delegated to Gemini via the `nestor-intent` Supabase Edge
 * Function — see `deriveIntentAsync` — with the original regex-based parser
 * (`parseIntent`/`refineIntent`) kept as an offline fallback if that call
 * fails. A first message is classified in-scope vs. out-of-scope locally
 * (`isLikelyOutOfScope`) before anything else runs — out-of-scope briefs
 * never reach the network.
 */

/** A compact one-line summary of a parsed intent, for the trace's intent step. */
function describeIntent(intent: NestorIntent): string {
  const parts: string[] = []
  if (intent.listingType) parts.push(intent.listingType)
  if (intent.region) parts.push(intent.region)
  if (intent.minBhk != null) parts.push(`${intent.minBhk}+ BHK`)
  if (intent.propertyType) parts.push(intent.propertyType)
  if (intent.maxPrice != null) parts.push(`≤ ${formatINR(intent.maxPrice)}`)
  const priorities = intent.priorities
    .slice(0, 2)
    .map((d) => DIMENSION_META[d].label.toLowerCase())
  if (priorities.length) parts.push(priorities.join(' + '))
  return parts.length ? parts.join(' · ') : 'balanced home search'
}

// --- Intent parsing --------------------------------------------------------

function has(text: string, ...words: string[]): boolean {
  return words.some((w) =>
    new RegExp(`\\b${w.replace(/ /g, '\\s+')}\\b`, 'i').test(text),
  )
}

function parseListingType(text: string): ListingType | undefined {
  if (has(text, 'rent', 'renting', 'rental', 'lease', 'tenant')) return 'Rent'
  if (has(text, 'buy', 'buying', 'purchase', 'own', 'owning')) return 'Buy'
  return undefined
}

function parseRegion(text: string): Region | undefined {
  if (has(text, 'bangalore', 'bengaluru', 'blr')) return 'Bangalore'
  if (has(text, 'hyderabad', 'hyd', 'cyberabad')) return 'Hyderabad'
  if (has(text, 'pune', 'pcmc')) return 'Pune'
  if (
    has(
      text,
      'delhi',
      'ncr',
      'gurugram',
      'gurgaon',
      'noida',
      'greater noida',
      'ghaziabad',
      'faridabad',
    )
  )
    return 'Delhi NCR'
  return undefined
}

function parsePropertyType(text: string): PropertyType | undefined {
  if (has(text, 'villa', 'villas')) return 'Villa'
  if (has(text, 'plot', 'plots', 'land')) return 'Plot'
  if (has(text, 'builder floor')) return 'Builder Floor'
  if (has(text, 'independent house', 'independent', 'standalone house'))
    return 'Independent House'
  if (has(text, 'apartment', 'apartments', 'flat', 'flats')) return 'Apartment'
  return undefined
}

function parseMinBhk(text: string): number | undefined {
  if (has(text, 'studio')) return 1
  const m = text.match(/(\d+)\s*(?:\+\s*)?(?:bhk|bedroom|bed|br)\b/i)
  return m ? Number(m[1]) : undefined
}

/**
 * Read a rupee budget from the brief. Understands `1.2 cr`, `80 lakh`, `45k`
 * (typical for rent) and plain amounts that follow a budget word. Returns the
 * first unit-bearing amount found, which is almost always the ceiling, plus
 * what that unit implies about listing type: `price` is a *sale* price for
 * Buy listings but a *monthly rent* for Rent listings, and nobody quotes rent
 * in lakhs/crores or a sale price in bare thousands, so the unit is a strong
 * signal even when the brief never says "buy" or "rent".
 */
function parseMaxPriceDetailed(
  text: string,
): { amount: number; impliesListingType?: ListingType } | undefined {
  const unitRe = /(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|l|k)\b/gi
  let match: RegExpExecArray | null
  while ((match = unitRe.exec(text)) !== null) {
    const n = Number(match[1])
    const unit = match[2].toLowerCase()
    if (unit.startsWith('cr'))
      return { amount: Math.round(n * 1_00_00_000), impliesListingType: 'Buy' }
    if (unit === 'k')
      return { amount: Math.round(n * 1_000), impliesListingType: 'Rent' }
    // lakh / lac / l
    return { amount: Math.round(n * 1_00_000), impliesListingType: 'Buy' }
  }
  const plain = text.match(
    /(?:budget|under|below|upto|up to|around|within|max|less than)\s*(?:of\s*)?₹?\s*(\d{4,})/i,
  )
  return plain ? { amount: Number(plain[1]) } : undefined
}

function parsePriorities(text: string): {
  priorities: Dimension[]
  usedDefault: boolean
  /** Life-stage labels matched in this message, earliest mention first. */
  lifestyleTags: string[]
} {
  const hits: { dim: Dimension; at: number }[] = []
  const tags: { label: string; at: number }[] = []

  const record = (dim: Dimension, at: number) => {
    if (at < 0) return
    const existing = hits.find((h) => h.dim === dim)
    if (existing) existing.at = Math.min(existing.at, at)
    else hits.push({ dim, at })
  }

  for (const dim of ALL_DIMENSIONS) {
    for (const kw of DIMENSION_META[dim].keywords) {
      const m = new RegExp(`\\b${kw.replace(/ /g, '\\s+')}\\b`, 'i').exec(text)
      if (m) record(dim, m.index)
    }
  }

  for (const stage of LIFE_STAGES) {
    const m = stage.pattern.exec(text)
    if (m) {
      stage.dimensions.forEach((dim) => record(dim, m.index))
      tags.push({ label: stage.label, at: m.index })
    }
  }

  const lifestyleTags = tags.sort((a, b) => a.at - b.at).map((t) => t.label)

  if (hits.length === 0) {
    return { priorities: DEFAULT_PRIORITIES, usedDefault: true, lifestyleTags }
  }
  return {
    priorities: hits.sort((a, b) => a.at - b.at).map((h) => h.dim),
    usedDefault: false,
    lifestyleTags,
  }
}

export function parseIntent(rawText: string): NestorIntent {
  const text = rawText.toLowerCase()
  const { priorities, usedDefault, lifestyleTags } = parsePriorities(text)
  const priceDetail = parseMaxPriceDetailed(text)
  return {
    listingType: parseListingType(text) ?? priceDetail?.impliesListingType,
    region: parseRegion(text),
    maxPrice: priceDetail?.amount,
    minBhk: parseMinBhk(text),
    propertyType: parsePropertyType(text),
    excludedPropertyTypes: [],
    priorities,
    usedDefaultPriorities: usedDefault,
    lifestyleTags,
    rawText,
  }
}

// --- Multi-turn refinement -------------------------------------------------
// Nestor carries structured conversation state (the last `NestorIntent`)
// rather than raw chat history. A follow-up message ("make it cheaper", "only
// Bangalore", "I don't want apartments") is merged onto the previous intent —
// explicit signals and relative modifiers win; unmentioned fields inherit.

const dedupe = <T,>(arr: T[]): T[] => Array.from(new Set(arr))

/** Property-type keyword table, reused by positive and negated detection. */
const PROPERTY_TYPE_KEYWORDS: [PropertyType, string[]][] = [
  ['Villa', ['villa', 'villas']],
  ['Plot', ['plot', 'plots', 'land']],
  ['Builder Floor', ['builder floor']],
  ['Independent House', ['independent house', 'independent', 'standalone house']],
  ['Apartment', ['apartment', 'apartments', 'flat', 'flats']],
]

/** Negation cue words that precede (within two words of) the thing ruled out. */
const NEG_CUE =
  `(?:no|not|don'?t\\s+(?:want|need|care(?:\\s+about)?)|dont\\s+(?:want|need|care(?:\\s+about)?)|` +
  `without|avoid|exclude|except|other\\s+than|no\\s+more|skip|drop|less)`

function negatedNear(text: string, keyword: string): boolean {
  const re = new RegExp(
    `\\b${NEG_CUE}\\s+(?:\\w+\\s+){0,2}${keyword.replace(/ /g, '\\s+')}\\b`,
    'i',
  )
  return re.test(text)
}

/** A property type the user explicitly ruled out in this message, if any. */
function parseNegatedPropertyType(text: string): PropertyType | undefined {
  for (const [type, keywords] of PROPERTY_TYPE_KEYWORDS) {
    if (keywords.some((kw) => negatedNear(text, kw))) return type
  }
  return undefined
}

/** Ranking dimensions the user asked to drop ("don't care about nightlife"). */
function parseNegatedDimensions(text: string): Dimension[] {
  const out: Dimension[] = []
  for (const dim of ALL_DIMENSIONS) {
    if (DIMENSION_META[dim].keywords.some((kw) => negatedNear(text, kw))) {
      out.push(dim)
    }
  }
  return out
}

const WANTS_CHEAPER =
  /\b(cheaper|more\s+affordable|less\s+expensive|too\s+expensive|lower\s+(?:the\s+)?(?:budget|price)|reduce\s+(?:the\s+)?(?:budget|price)|tighter\s+budget|smaller\s+budget|lower\s+it)\b/i
const WANTS_PRICIER =
  /\b(increase\s+(?:the\s+)?budget|raise\s+(?:the\s+)?budget|higher\s+budget|bigger\s+budget|spend\s+more|more\s+expensive|expand\s+(?:the\s+)?budget|up\s+(?:the\s+)?budget|stretch\s+(?:the\s+)?budget)\b/i
const WANTS_ANY_CITY =
  /\b(any\s*city|anywhere|all\s+cities|other\s+cities|expand\s+(?:the\s+)?(?:city|search|area|cities))\b/i
const WANTS_ANY_TYPE = /\b(any\s+(?:type|property|kind)|all\s+(?:types|properties))\b/i

/**
 * Merge a follow-up message onto the previous intent. Returns `changed: false`
 * when nothing recognisable was found, so the caller can preserve context.
 */
function refineIntent(
  prev: NestorIntent,
  rawText: string,
): { intent: NestorIntent; changed: boolean } {
  const text = rawText.toLowerCase()
  const base: NestorIntent = {
    ...prev,
    excludedPropertyTypes: [...prev.excludedPropertyTypes],
    priorities: [...prev.priorities],
    lifestyleTags: [...prev.lifestyleTags],
    rawText,
  }
  let changed = false

  const listingType = parseListingType(text)
  if (listingType && listingType !== base.listingType) {
    base.listingType = listingType
    changed = true
  }

  if (WANTS_ANY_CITY.test(text)) {
    if (base.region !== undefined) {
      base.region = undefined
      changed = true
    }
  } else {
    const region = parseRegion(text)
    if (region && region !== base.region) {
      base.region = region
      changed = true
    }
  }

  const minBhk = parseMinBhk(text)
  if (minBhk != null && minBhk !== base.minBhk) {
    base.minBhk = minBhk
    changed = true
  }

  // Property type: "any type" clears everything; a negation rules a type out;
  // a positive mention sets it (and un-excludes it). Negation is read first so
  // "no apartments" doesn't get treated as a request *for* apartments.
  if (WANTS_ANY_TYPE.test(text)) {
    if (base.propertyType !== undefined || base.excludedPropertyTypes.length) {
      base.propertyType = undefined
      base.excludedPropertyTypes = []
      changed = true
    }
  }
  const negType = parseNegatedPropertyType(text)
  if (negType) {
    if (!base.excludedPropertyTypes.includes(negType)) {
      base.excludedPropertyTypes.push(negType)
      changed = true
    }
    if (base.propertyType === negType) {
      base.propertyType = undefined
      changed = true
    }
  }
  const posType = negType ? undefined : parsePropertyType(text)
  if (posType && posType !== base.propertyType) {
    base.propertyType = posType
    base.excludedPropertyTypes = base.excludedPropertyTypes.filter(
      (t) => t !== posType,
    )
    changed = true
  }

  // Budget: an explicit amount wins; otherwise nudge the carried budget. A
  // lakh/crore or bare-thousands unit implies Buy/Rent respectively — only
  // apply that inference when this message didn't already state the type.
  const priceDetail = parseMaxPriceDetailed(text)
  if (priceDetail != null && priceDetail.amount !== base.maxPrice) {
    base.maxPrice = priceDetail.amount
    changed = true
    if (!listingType && priceDetail.impliesListingType) {
      base.listingType = priceDetail.impliesListingType
    }
  } else if (WANTS_CHEAPER.test(text) && base.maxPrice != null) {
    base.maxPrice = Math.round(base.maxPrice * 0.8)
    changed = true
  } else if (WANTS_PRICIER.test(text) && base.maxPrice != null) {
    base.maxPrice = Math.round(base.maxPrice * 1.25)
    changed = true
  }

  // Priorities: newly named ones move to the front (highest weight); dropped
  // ones are filtered out. Falls back to the balanced default if emptied.
  const {
    priorities: newPris,
    usedDefault: newUsedDefault,
    lifestyleTags: newTags,
  } = parsePriorities(text)
  if (!newUsedDefault) {
    base.priorities = dedupe([...newPris, ...base.priorities])
    base.usedDefaultPriorities = false
    changed = true
  }
  if (newTags.length) {
    base.lifestyleTags = dedupe([...base.lifestyleTags, ...newTags])
    changed = true
  }
  const negDims = parseNegatedDimensions(text)
  if (negDims.length) {
    const kept = base.priorities.filter((d) => !negDims.includes(d))
    base.priorities = kept.length ? kept : DEFAULT_PRIORITIES
    base.usedDefaultPriorities = kept.length === 0
    changed = true
  }

  return { intent: base, changed }
}

/**
 * Words that plausibly signal a home-search brief even when no hard filter
 * matched (e.g. "find me a good place to live"). Backs `isLikelyOutOfScope`,
 * the local classifier that gates every first message *before* Gemini is
 * called at all — Gemini's own `offTopic` field (see the edge function's
 * SYSTEM_PROMPT) only ever runs on messages this has already let through, as
 * a second, more nuanced opinion.
 */
const HOME_SEARCH_HINTS =
  /\b(home|homes|house|houses|flat|flats|apartment|apartments|propert(?:y|ies)|villa|villas|plot|plots|real\s*estate|bhk|rent|renting|buy|buying|budget|locality|neighbo(?:u)?rhood|move|moving|relocat\w*|live|living|lease|tenant|listing|listings)\b/i

/** True when an intent carries no signal at all — every field is unset/default. */
function isEmptyIntent(intent: NestorIntent): boolean {
  return (
    !intent.listingType &&
    !intent.region &&
    intent.maxPrice == null &&
    intent.minBhk == null &&
    !intent.propertyType &&
    intent.usedDefaultPriorities &&
    intent.lifestyleTags.length === 0
  )
}

/**
 * The lightweight intent classifier: a first message with no home-search
 * signal at all (no city, budget, BHK, property type, priority/life-stage
 * keyword, or generic home-search word) is out of scope. Runs entirely
 * locally so greetings, general-AI/programming questions, current events,
 * math, and gibberish never reach Gemini or Supabase — see `deriveIntentAsync`,
 * which checks this *before* calling the edge function. A mixed prompt
 * ("explain React and show me houses") still matches on the relevant part,
 * so it's classified in-scope and the irrelevant part is simply never
 * extracted into the intent.
 */
export function isLikelyOutOfScope(rawText: string): boolean {
  return isEmptyIntent(parseIntent(rawText)) && !HOME_SEARCH_HINTS.test(rawText)
}

/**
 * Decide how to read a message: the first turn (or one with no prior context)
 * is parsed fresh; a later turn is refined onto the previous intent. When a
 * follow-up carries no recognisable signal, the prior intent is kept as-is.
 * This is the offline fallback used when the Gemini edge function is
 * unavailable — see `deriveIntentAsync`.
 */
export function deriveIntent(
  rawText: string,
  prev?: NestorIntent,
): { intent: NestorIntent; refined: boolean } {
  if (!prev) return { intent: parseIntent(rawText), refined: false }
  const { intent, changed } = refineIntent(prev, rawText)
  if (changed) return { intent, refined: true }
  return { intent: { ...prev, rawText }, refined: false }
}

/**
 * Ask the `nestor-intent` Supabase Edge Function (Gemini 2.5 Flash) to parse
 * the brief. Returns `null` on any failure — network error, missing/invalid
 * response — so the caller can fall back to the local regex parser rather
 * than breaking Nestor when the edge function or Gemini is unavailable.
 */
async function deriveIntentRemote(
  rawText: string,
  prev?: NestorIntent,
): Promise<{ intent: NestorIntent; refined: boolean; offTopic: boolean } | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      intent: NestorIntent
      refined: boolean
      offTopic?: boolean
    }>('nestor-intent', { body: { rawText, prevIntent: prev } })
    if (error || !data?.intent) return null
    return { intent: data.intent, refined: data.refined, offTopic: Boolean(data.offTopic) }
  } catch {
    return null
  }
}

/**
 * The entry point `runNestor` uses. A first message is classified locally
 * (`isLikelyOutOfScope`) *before* touching the network — out-of-scope briefs
 * short-circuit here, so they never spend a Gemini call or hit Supabase.
 * Anything that passes the local classifier goes to Gemini-backed parsing,
 * falling back to the deterministic local parser if that call fails for any
 * reason — including the edge function's own rate limit, which returns a
 * non-2xx response and lands here rather than erroring the UI.
 */
export async function deriveIntentAsync(
  rawText: string,
  prev?: NestorIntent,
  onTrace?: NestorTrace,
): Promise<{ intent: NestorIntent; refined: boolean; offTopic: boolean }> {
  onTrace?.({ step: 'scope', status: 'active', label: 'Checking scope' })
  if (!prev && isLikelyOutOfScope(rawText)) {
    onTrace?.({
      step: 'scope',
      status: 'done',
      label: 'Out of scope',
      detail: 'Not a home search',
    })
    return { ...deriveIntent(rawText, prev), offTopic: true }
  }
  onTrace?.({ step: 'scope', status: 'done', label: 'In scope' })

  onTrace?.({ step: 'intent', status: 'active', label: 'Reading your brief' })
  const remote = await deriveIntentRemote(rawText, prev)
  const result = remote ?? {
    ...deriveIntent(rawText, prev),
    offTopic: !prev && isLikelyOutOfScope(rawText),
  }
  if (result.offTopic) {
    onTrace?.({
      step: 'intent',
      status: 'done',
      label: 'Not a home search',
      detail: 'Redirecting',
    })
  } else {
    onTrace?.({
      step: 'intent',
      status: 'done',
      label: result.refined ? 'Brief refined' : 'Brief understood',
      detail: describeIntent(result.intent),
    })
  }
  return result
}

/** Project an intent onto the subset of fields the Explore filters understand. */
export function intentToFilters(intent: NestorIntent): PropertyFilters {
  const filters: PropertyFilters = {}
  if (intent.listingType) filters.listingType = intent.listingType
  if (intent.region) filters.region = intent.region
  if (intent.propertyType) filters.propertyType = intent.propertyType
  if (intent.minBhk != null) filters.minBhk = intent.minBhk
  if (intent.maxPrice != null) filters.maxPrice = intent.maxPrice
  return filters
}

/** Example briefs shown as starter chips in the empty state. */
export const EXAMPLE_BRIEFS: string[] = [
  'Family with two kids, buying a 3 BHK in Bangalore under ₹1.5 Cr — safety and good schools matter most.',
  'Young couple renting in Hyderabad, budget 45k, want nightlife and an easy commute to the IT park.',
  'Looking for a high-investment 2 BHK apartment in Pune under 90 lakh.',
  'Peaceful, green 3 BHK villa in Delhi NCR for my retired parents.',
  "We're expecting our first baby and I work remotely — need a peaceful 3 BHK to buy in Bangalore under ₹1.8 Cr.",
]
