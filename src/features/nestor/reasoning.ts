import { LISTINGS } from '@/features/properties/data/listings'
import { supabase } from '@/lib/supabase'
import {
  pricePerSqft,
  type ListingType,
  type Property,
  type PropertyFilters,
  type PropertyInsights,
  type PropertyType,
  type Region,
} from '@/features/properties/types'
import { formatINR, joinClauses } from '@/lib/utils'

/**
 * Nestor's reasoning engine. A first message is classified in-scope vs.
 * out-of-scope locally (`isLikelyOutOfScope`) before anything else runs —
 * out-of-scope briefs never reach the network. In-scope intent parsing
 * (turning a free-text brief into a structured `NestorIntent`) is delegated
 * to Gemini 2.5 Flash via the `nestor-intent` Supabase Edge Function — see
 * `deriveIntentAsync` below — with the original regex-based parser
 * (`parseIntent`/`refineIntent`) kept as an offline fallback if that call
 * fails. Everything downstream of intent (candidate selection, fit scoring,
 * strengths/trade-off/confidence text, near-misses) stays fully
 * deterministic, so the same intent always yields the same, defensible
 * answer.
 */

/** The locality-score dimensions we rank on, with display labels + trigger words. */
type Dimension = keyof PropertyInsights

const DIMENSION_META: Record<
  Dimension,
  { label: string; keywords: string[] }
> = {
  walkability: {
    label: 'Walkability',
    keywords: ['walkable', 'walkability', 'walk to', 'pedestrian', 'on foot'],
  },
  familyScore: {
    label: 'Family-friendly',
    keywords: [
      'family',
      'families',
      'kid',
      'kids',
      'child',
      'children',
      'school',
      'schools',
      'playground',
    ],
  },
  investmentScore: {
    label: 'Investment',
    keywords: [
      'investment',
      'invest',
      'appreciation',
      'resale',
      'roi',
      'returns',
      'rental yield',
      'yield',
      'capital growth',
    ],
  },
  commuteScore: {
    label: 'Commute',
    keywords: [
      'commute',
      'office',
      'work',
      'workplace',
      'it park',
      'tech park',
      'metro',
      'connectivity',
      'connected',
      'short drive',
    ],
  },
  safetyScore: {
    label: 'Safety',
    keywords: ['safe', 'safety', 'secure', 'security', 'gated', 'low crime'],
  },
  nightlifeScore: {
    label: 'Nightlife',
    keywords: [
      'nightlife',
      'pub',
      'pubs',
      'bar',
      'bars',
      'restaurant',
      'restaurants',
      'cafe',
      'cafes',
      'social',
      'vibrant',
      'happening',
    ],
  },
  greenScore: {
    label: 'Green & calm',
    keywords: [
      'green',
      'greenery',
      'parks',
      'nature',
      'trees',
      'quiet',
      'peaceful',
      'calm',
      'serene',
      'open space',
      'fresh air',
    ],
  },
}

const ALL_DIMENSIONS = Object.keys(DIMENSION_META) as Dimension[]

/** A ranking dimension, exposed for the editable-priorities UI. */
export type PriorityDimension = Dimension

/** All ranking dimensions with display labels, for the priority chip editor. */
export const PRIORITY_OPTIONS: { value: PriorityDimension; label: string }[] =
  ALL_DIMENSIONS.map((dim) => ({ value: dim, label: DIMENSION_META[dim].label }))

/** When the brief gives no explicit priorities, rank on this balanced profile. */
const DEFAULT_PRIORITIES: Dimension[] = [
  'familyScore',
  'safetyScore',
  'commuteScore',
  'investmentScore',
]

/**
 * Life-stage / lifestyle phrases that imply a set of priorities without
 * naming them (e.g. "I'm newly married" implies nightlife + commute). `label`
 * is surfaced back to the user in the "interpreted priorities" disclosure so
 * they can see *why* a dimension was picked, not just that it was.
 */
const LIFE_STAGES: { pattern: RegExp; dimensions: Dimension[]; label: string }[] = [
  {
    pattern: /\b(retire|retirement|retiring|senior|elderly|old(er)? parents)\b/i,
    dimensions: ['greenScore', 'safetyScore', 'walkability'],
    label: 'Retiring / senior living',
  },
  {
    pattern: /\b(young couple|newly ?wed|newly married|just married|dinks?)\b/i,
    dimensions: ['nightlifeScore', 'commuteScore', 'investmentScore'],
    label: 'Newly married',
  },
  {
    pattern: /\b(bachelor|single|solo|working professional|it professional)\b/i,
    dimensions: ['commuteScore', 'nightlifeScore'],
    label: 'Single professional',
  },
  {
    pattern: /\b(growing family|family with (kids|children)|school-going)\b/i,
    dimensions: ['familyScore', 'safetyScore', 'greenScore'],
    label: 'Growing family',
  },
  {
    pattern: /\b(investor|investment property|second home|rental income)\b/i,
    dimensions: ['investmentScore', 'commuteScore'],
    label: 'Investor',
  },
  {
    pattern:
      /\b(expecting( a baby)?|pregnant|having a baby|planning a family|trying for a baby|kids? soon|kids? on the way|baby on the way)\b/i,
    dimensions: ['familyScore', 'safetyScore', 'greenScore'],
    label: 'Expecting / planning a family',
  },
  {
    pattern:
      /\b(parents? (?:will\s+)?(?:stay|staying|move|moving|live|living) with (?:us|me)|joint family|multi-?generational|in-?laws? (?:stay|staying|living) with (?:us|me))\b/i,
    dimensions: ['familyScore', 'safetyScore', 'walkability'],
    label: 'Multigenerational household',
  },
  {
    pattern:
      /\b(work(?:s|ing)? remotely|work(?:s|ing)? from home|remote job|remote work|\bwfh\b|freelanc(?:e|er|ing))\b/i,
    dimensions: ['greenScore', 'walkability'],
    label: 'Remote / work-from-home',
  },
  {
    pattern: /\b(have a dog|have a cat|have (?:a )?pet|pet-?friendly|dog owner|dog parent|cat owner)\b/i,
    dimensions: ['greenScore', 'walkability'],
    label: 'Pet owner',
  },
]

export interface NestorIntent {
  listingType?: ListingType
  region?: Region
  maxPrice?: number
  minBhk?: number
  propertyType?: PropertyType
  /** Property types the user has explicitly ruled out ("no apartments"). */
  excludedPropertyTypes: PropertyType[]
  /** Ranking dimensions, most-important first. */
  priorities: Dimension[]
  /** True when we fell back to the balanced default (no priorities detected). */
  usedDefaultPriorities: boolean
  /**
   * Life-stage / lifestyle phrases detected in the brief (e.g. "Newly
   * married", "Remote / work-from-home"), for the interpreted-priorities
   * disclosure — explains *why* certain dimensions were inferred.
   */
  lifestyleTags: string[]
  rawText: string
}

export interface RankedPick {
  property: Property
  /** 0–100 weighted fit against the brief's priorities. */
  fit: number
  /** Plain-language reasons this home fits the brief — no raw scores surfaced. */
  strengths: string[]
  tradeoff: string
  /** What the fit score is grounded in — the confidence rationale for this pick. */
  confidenceBasis: string
}

/** A home that was filtered out, kept to explain "why wasn't this recommended?". */
export interface RejectedPick {
  property: Property
  /** 0–100 weighted fit — often high; it's a constraint, not fit, that ruled it out. */
  fit: number
  /** The single binding reason this home didn't make the cut. */
  reason: string
}

export interface NestorAnswer {
  intent: NestorIntent
  summary: string
  picks: RankedPick[]
  /** Strong homes excluded by exactly one hard constraint, with the reason. */
  rejected: RejectedPick[]
  totalMatched: number
  /** True when this brief refined the previous one (multi-turn memory). */
  refined: boolean
  /** Present when we had to loosen filters to find enough homes. */
  relaxedNote?: string
  /**
   * True when the message wasn't a home-search brief at all (e.g. a question
   * about this app or something unrelated) — only ever set on a first turn.
   * `picks`/`rejected` are empty and `summary` is a redirect, not a search
   * result, so the UI should skip the picks/priority-editor rendering.
   */
  offTopic?: boolean
  /**
   * True when this was a follow-up turn that carried no recognisable search
   * signal at all (an acknowledgment like "ok thanks", or an off-topic aside
   * mid-conversation) — `picks`/`rejected` are empty and `summary` is a short
   * conversational reply rather than a re-run of the previous search. The UI
   * should skip picks/priority-editor rendering, same as `offTopic`.
   */
  noNewSignal?: boolean
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
): Promise<{ intent: NestorIntent; refined: boolean; offTopic: boolean }> {
  if (!prev && isLikelyOutOfScope(rawText)) {
    return { ...deriveIntent(rawText, prev), offTopic: true }
  }
  const remote = await deriveIntentRemote(rawText, prev)
  if (remote) return remote
  const local = deriveIntent(rawText, prev)
  const offTopic = !prev && isLikelyOutOfScope(rawText)
  return { ...local, offTopic }
}

// --- Candidate selection + ranking -----------------------------------------

function matches(p: Property, intent: NestorIntent): boolean {
  if (intent.listingType && p.listingType !== intent.listingType) return false
  if (intent.region && p.region !== intent.region) return false
  if (intent.maxPrice != null && p.price > intent.maxPrice) return false
  if (intent.minBhk != null && p.bhk < intent.minBhk) return false
  if (intent.propertyType && p.propertyType !== intent.propertyType)
    return false
  if (intent.excludedPropertyTypes.includes(p.propertyType)) return false
  return true
}

/** Loosen filters — cheapest constraint first — until we have enough homes. */
function selectCandidates(intent: NestorIntent): {
  list: Property[]
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
          maxPrice: i.maxPrice != null ? Math.round(i.maxPrice * 1.25) : undefined,
        }),
      },
      { label: 'city', apply: (i) => ({ ...i, region: undefined }) },
    ]

  let current = intent
  let list = LISTINGS.filter((p) => matches(p, current))
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
    list = LISTINGS.filter((p) => matches(p, current))
    relaxed.push(r.label)
  }

  return { list, relaxed }
}

function fitScore(p: Property, priorities: Dimension[]): number {
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

const STRONG = 80
const DECENT = 65

/**
 * The "Why this home" list. We lead with the dimensions the user actually
 * prioritised (why it fits *them*), then top up with the home's own standout
 * traits if that's thin — always qualitative, never a raw score.
 */
function buildStrengths(p: Property, priorities: Dimension[]): string[] {
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
function buildConfidenceBasis(
  p: Property,
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

/**
 * The flexible hard constraints a home breaks against the *original* brief, as
 * readable reasons. Listing type is deliberately excluded — a rental is never a
 * near-miss for a purchase — so this only covers budget, city, BHK and type.
 */
function describeFails(p: Property, intent: NestorIntent): string[] {
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

function findNearMisses(
  intent: NestorIntent,
  excludeIds: Set<string>,
): RejectedPick[] {
  return LISTINGS.filter((p) => !excludeIds.has(p.id))
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

function buildTradeoff(p: Property, intent: NestorIntent): string {
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

function buildSummary(
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

/** Rank + explain the seed listings for an already-resolved intent. */
function answerFor(
  rawIntent: NestorIntent,
  refined: boolean,
  topN: number,
): NestorAnswer {
  // An empty priority list would divide by zero in `fitScore`; fall back to the
  // balanced default (can happen if the user removes every priority chip).
  const intent: NestorIntent = rawIntent.priorities.length
    ? rawIntent
    : { ...rawIntent, priorities: DEFAULT_PRIORITIES, usedDefaultPriorities: true }

  const { list, relaxed } = selectCandidates(intent)

  const picks: RankedPick[] = list
    .map((property) => ({
      property,
      fit: fitScore(property, intent.priorities),
    }))
    .sort((a, b) => {
      if (b.fit !== a.fit) return b.fit - a.fit
      // Tie-break on value: cheaper per-sqft wins.
      return pricePerSqft(a.property) - pricePerSqft(b.property)
    })
    .slice(0, topN)
    .map(({ property, fit }) => ({
      property,
      fit,
      strengths: buildStrengths(property, intent.priorities),
      tradeoff: buildTradeoff(property, intent),
      confidenceBasis: buildConfidenceBasis(property, intent, relaxed),
    }))

  const pickIds = new Set(picks.map((pick) => pick.property.id))

  return {
    intent,
    summary: buildSummary(intent, relaxed, refined),
    picks,
    rejected: findNearMisses(intent, pickIds),
    totalMatched: list.length,
    refined,
    relaxedNote: relaxed.length ? relaxed.join(', ') : undefined,
  }
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
 * Run the full pipeline: brief → intent → ranked, explained picks. Pass the
 * previous turn's intent to refine it (multi-turn memory) instead of starting
 * from scratch. Intent parsing goes through Gemini (`deriveIntentAsync`),
 * falling back to the local parser if that call fails. A first message with
 * no home-search signal at all short-circuits to a redirect instead of
 * ranking the full, unfiltered catalogue (see `offTopicAnswer`); a follow-up
 * with no recognisable signal short-circuits to a short acknowledgment
 * instead of re-running the previous search (see `noNewSignalAnswer`).
 */
export async function runNestor(
  rawText: string,
  prevIntent?: NestorIntent,
  topN = 3,
): Promise<NestorAnswer> {
  const { intent, refined, offTopic } = await deriveIntentAsync(rawText, prevIntent)
  if (offTopic && !prevIntent) return offTopicAnswer(rawText)
  if (prevIntent && !refined) return noNewSignalAnswer(prevIntent, rawText)
  return answerFor(intent, refined, topN)
}

/**
 * Re-rank an existing intent after the user edits its priorities in the UI —
 * no re-parsing, just a fresh ranking against the updated weights.
 */
export function rerankIntent(intent: NestorIntent, topN = 3): NestorAnswer {
  return answerFor(intent, true, topN)
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
