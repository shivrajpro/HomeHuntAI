// Supabase Edge Function: turns a free-text Nestor brief (plus, on a
// follow-up turn, the previous structured intent) into the same
// `NestorIntent` shape `src/features/nestor/reasoning.ts` used to produce
// with regex parsing. Ranking and explanation text stay deterministic in the
// frontend — this function only replaces the natural-language understanding
// step, using Gemini Flash with a constrained JSON schema so the output
// always matches what the rest of the app expects.
import { GoogleGenAI } from 'npm:@google/genai'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
// Picked by live probing against this project's actual key/quota:
// gemini-2.5-flash/-lite are hard-blocked for new API keys (404), the
// gemini-2.0-flash line has zero free-tier quota on this key (429), and
// gemini-3.5-flash / gemini-flash-latest were consistently 503 "high
// demand" at integration time. gemini-flash-lite-latest (an alias Google
// keeps pointed at its current default lite-flash model) responded
// reliably — plenty capable for structured JSON intent extraction, which
// doesn't need full-flash reasoning depth.
const GEMINI_MODEL = 'gemini-flash-lite-latest'
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? '' })

// Service-role client, used only to enforce the per-caller rate limit below —
// never exposed to the browser. Auto-populated by the Supabase Edge Function
// runtime, no manual config needed.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// Cheap abuse guard: cap how many Gemini calls a single caller can trigger.
// The `nestor_requests` log is shared with `nestor-reason`, and a full Nestor
// turn now costs two Gemini calls (parse here + reason there), so 60 keeps
// the same ~30 turns/hour budget the original single-call limit allowed. The
// app degrades gracefully rather than erroring when this trips, since
// `reasoning.ts` falls back to the local regex parser on any non-2xx
// response from this function. This bounds Gemini spend without needing a
// hard per-key cost cap (Gemini/Cloud Billing has no such thing built in).
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 60
// Bounds prompt size fed to Gemini — also cuts off obvious paste-spam abuse.
const MAX_RAW_TEXT_LENGTH = 500

async function isRateLimited(clientKey: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await supabaseAdmin
    .from('nestor_requests')
    .select('*', { count: 'exact', head: true })
    .eq('client_key', clientKey)
    .gte('created_at', since)
  // If the rate-limit check itself fails (e.g. table unreachable), fail open
  // rather than breaking Nestor over an unrelated infra hiccup.
  if (error) return false
  if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) return true
  await supabaseAdmin.from('nestor_requests').insert({ client_key: clientKey })
  return false
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const REGIONS = ['Bangalore', 'Hyderabad', 'Delhi NCR', 'Pune'] as const
const LISTING_TYPES = ['Buy', 'Rent'] as const
const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Plot',
  'Builder Floor',
  'Independent House',
] as const
const DIMENSIONS = [
  'walkability',
  'familyScore',
  'investmentScore',
  'commuteScore',
  'safetyScore',
  'nightlifeScore',
  'greenScore',
] as const

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    listingType: { type: 'string', enum: [...LISTING_TYPES, 'unknown'] },
    region: { type: 'string', enum: [...REGIONS, 'unknown'] },
    maxPrice: { type: 'number', nullable: true },
    minBhk: { type: 'integer', nullable: true },
    propertyType: { type: 'string', enum: [...PROPERTY_TYPES, 'unknown'] },
    excludedPropertyTypes: { type: 'array', items: { type: 'string', enum: PROPERTY_TYPES } },
    priorities: {
      type: 'array',
      items: { type: 'string', enum: DIMENSIONS },
      description: 'Most important first. Empty if none were named or implied.',
    },
    lifestyleTags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Human-readable life-stage labels detected, e.g. "Newly married".',
    },
    changed: {
      type: 'boolean',
      description: 'On a follow-up turn: true if this message changed anything about the previous intent.',
    },
    offTopic: {
      type: 'boolean',
      description:
        'True if this message is not about searching for a home to buy or rent at all (e.g. a question about the app itself, deployment, coding, or anything unrelated to real estate). False for any genuine home-search brief, even a vague one like "find me a good home".',
    },
  },
  required: [
    'listingType',
    'region',
    'maxPrice',
    'minBhk',
    'propertyType',
    'excludedPropertyTypes',
    'priorities',
    'lifestyleTags',
    'changed',
    'offTopic',
  ],
}

const SYSTEM_PROMPT = `You are Nestor, the natural-language understanding layer for HomeHuntAI, a home-search product for the Indian property market (Bangalore, Hyderabad, Delhi NCR, Pune). Extract a structured search intent from the user's message.

Fields:
- listingType: "Buy" or "Rent". Infer from words (buy/purchase/own -> Buy; rent/renting/lease/tenant -> Rent) OR from the budget unit if no word is given: crore/lakh amounts imply Buy (it's a sale price), bare thousands ("45k") imply Rent (it's monthly rent). Use "unknown" if genuinely undetermined.
- region: one of Bangalore, Hyderabad, Delhi NCR, Pune (also accept aliases: Bengaluru/BLR -> Bangalore; Hyd/Cyberabad -> Hyderabad; Gurugram/Gurgaon/Noida/Greater Noida/Ghaziabad/Faridabad/NCR -> Delhi NCR; PCMC -> Pune). "unknown" if no city named.
- maxPrice: a rupee ceiling as a plain number (e.g. "1.2 cr" -> 12000000, "80 lakh" -> 8000000, "45k" -> 45000). If the message doesn't name a budget, use null.
- minBhk: integer BHK/bedroom minimum. "studio" -> 1. null if not mentioned.
- propertyType: one of Apartment, Villa, Plot, Builder Floor, Independent House ("flat" -> Apartment, "land" -> Plot, "standalone house"/"independent" -> Independent House). "unknown" if not mentioned.
- excludedPropertyTypes: property types the user explicitly ruled out (e.g. "no apartments", "not a villa", "don't want a plot").
- priorities: ranking dimensions the brief cares about, MOST IMPORTANT FIRST (order matters — first-named or most emphasized counts most):
  - walkability — walkable, walk to, pedestrian, on foot
  - familyScore — family, kids, children, schools, playground
  - investmentScore — investment, appreciation, resale, ROI, rental yield, capital growth
  - commuteScore — commute, office, IT park, tech park, metro, connectivity
  - safetyScore — safe, secure, security, gated, low crime
  - nightlifeScore — nightlife, pubs, bars, restaurants, cafes, social, vibrant
  - greenScore — green, parks, nature, trees, quiet, peaceful, calm, open space
  Also infer priorities from life-stage phrases even when no dimension word is used, and add a matching entry to lifestyleTags:
  - retiring/senior/elderly/older parents -> greenScore, safetyScore, walkability ("Retiring / senior living")
  - young couple/newlywed/DINKs -> nightlifeScore, commuteScore, investmentScore ("Newly married")
  - bachelor/single/solo/working professional -> commuteScore, nightlifeScore ("Single professional")
  - growing family/family with kids/school-going -> familyScore, safetyScore, greenScore ("Growing family")
  - investor/investment property/second home/rental income -> investmentScore, commuteScore ("Investor")
  - expecting a baby/pregnant/planning a family -> familyScore, safetyScore, greenScore ("Expecting / planning a family")
  - parents/in-laws staying with us, joint/multigenerational family -> familyScore, safetyScore, walkability ("Multigenerational household")
  - works remotely/work from home/WFH/freelancer -> greenScore, walkability ("Remote / work-from-home")
  - has a dog/cat/pet, pet-friendly -> greenScore, walkability ("Pet owner")
  If nothing is named or implied, return an empty priorities array and an empty lifestyleTags array (the caller applies a balanced default).
- changed: only meaningful when a "Previous intent" is provided below (a follow-up turn). Set true if this message adds, changes, or removes anything versus the previous intent (including relative nudges like "make it cheaper" changing the budget, or "I don't want apartments" adding an exclusion). Set false if the message contains no recognizable search signal at all.
- offTopic: only meaningful on a FIRST message (no "Previous intent" provided below) — always return false if a previous intent is given, since the conversation is already about a home search. On a first message, set true when the text is clearly not an attempt to search for a home at all — questions about this app itself ("how do I deploy this to Vercel", "what stack is this built with"), unrelated coding/general-knowledge questions, greetings with no search content, jokes, spam, etc. Set false for any genuine home-search brief, however vague ("find me a good home", "something affordable", "I need a place to live").

On a follow-up turn, merge onto the previous intent rather than starting over:
- An explicit new value (city, type, BHK, budget, listing type) overrides the previous one.
- "make it cheaper" / "too expensive" / "lower the budget" -> multiply the previous maxPrice by 0.8 (only if a previous maxPrice exists and no new explicit amount was given).
- "increase the budget" / "spend more" / "raise the budget" -> multiply the previous maxPrice by 1.25 (same condition).
- "any city" / "anywhere" / "expand the search" -> clear region.
- "any type" / "all types" -> clear propertyType and excludedPropertyTypes.
- A negated property type ("no apartments", "don't want a villa") adds to excludedPropertyTypes and clears propertyType if it matched the same type.
- "don't care about X" / "no longer need X" for a priority dimension removes it from priorities.
- Newly named priorities in this message move to the FRONT of the previous priorities list (deduplicated), not replace them.
- Newly named lifestyleTags are appended to the previous ones (deduplicated).
- Anything not mentioned in this message is carried over unchanged from the previous intent.

Only use fields explicitly present or clearly implied — never invent a city, price, or property type that isn't supported by the text. Respond with JSON matching the schema exactly.`

interface GeminiIntentResult {
  listingType: string
  region: string
  maxPrice: number | null
  minBhk: number | null
  propertyType: string
  excludedPropertyTypes: string[]
  priorities: string[]
  lifestyleTags: string[]
  changed: boolean
  offTopic: boolean
}

async function callGemini(prompt: string): Promise<GeminiIntentResult> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
      // Structured intent JSON is tiny; this is just a spend backstop.
      maxOutputTokens: 512,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as GeminiIntentResult
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { rawText: rawTextInput, prevIntent } = await req.json()
    if (typeof rawTextInput !== 'string' || !rawTextInput.trim()) {
      return new Response(JSON.stringify({ error: 'rawText is required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }
    const rawText = rawTextInput.trim().slice(0, MAX_RAW_TEXT_LENGTH)

    const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (await isRateLimited(clientKey)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const prompt = prevIntent
      ? `Previous intent (JSON): ${JSON.stringify(prevIntent)}\n\nFollow-up message: ${JSON.stringify(rawText)}`
      : `First message: ${JSON.stringify(rawText)}`

    const result = await callGemini(prompt)

    const intent = {
      listingType: LISTING_TYPES.includes(result.listingType as typeof LISTING_TYPES[number])
        ? result.listingType
        : undefined,
      region: REGIONS.includes(result.region as typeof REGIONS[number]) ? result.region : undefined,
      maxPrice: result.maxPrice ?? undefined,
      minBhk: result.minBhk ?? undefined,
      propertyType: PROPERTY_TYPES.includes(result.propertyType as typeof PROPERTY_TYPES[number])
        ? result.propertyType
        : undefined,
      excludedPropertyTypes: result.excludedPropertyTypes ?? [],
      priorities: result.priorities ?? [],
      usedDefaultPriorities: (result.priorities ?? []).length === 0,
      lifestyleTags: result.lifestyleTags ?? [],
      rawText,
    }

    // offTopic only matters on a first turn — see the SYSTEM_PROMPT note; a
    // follow-up is already inside a home-search conversation.
    return new Response(
      JSON.stringify({
        intent,
        refined: prevIntent ? Boolean(result.changed) : false,
        offTopic: !prevIntent && Boolean(result.offTopic),
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
