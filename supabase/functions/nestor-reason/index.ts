// Supabase Edge Function: Nestor's reasoning step. The client derives a
// structured intent (see `nestor-intent`), deterministically shortlists the
// strongest candidate listings, and sends them here with the user's brief.
// Gemini then does the actual deciding: it picks the best homes, ranks them,
// judges a 0–100 fit for each, and writes every piece of explanation text
// (summary, strengths, trade-off, confidence basis) grounded in the real
// listing data it was given. Anti-hallucination contract: Gemini may only
// reference the candidates it received — every returned id is validated
// against the submitted set, and the client falls back to its deterministic
// ranking on any failure, so a bad or unavailable Gemini can never invent a
// home or break Nestor.
import { GoogleGenAI } from 'npm:@google/genai'
import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
// Same live-probed choice as `nestor-intent` (2.5-flash 404s for new keys,
// 2.0-flash has no free quota on this key, full-flash aliases were 503ing),
// overridable via env if a stronger model becomes available on this key.
const GEMINI_MODEL =
  Deno.env.get('GEMINI_REASONING_MODEL') ?? 'gemini-flash-lite-latest'
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY ?? '' })

// Service-role client, used only for the per-caller rate limit — never
// exposed to the browser.
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

// Shares `nestor_requests` with `nestor-intent`, so the cap is on *total*
// Gemini calls per caller across both functions. A full Nestor turn now costs
// two calls (parse + reason), hence 60 here and in `nestor-intent` — the same
// ~30 turns/hour budget the original single-call limit allowed.
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const RATE_LIMIT_MAX_REQUESTS = 60
const MAX_BRIEF_LENGTH = 500
// The client sends at most 12 candidates; anything bigger is not our client.
const MAX_CANDIDATES = 15
// Token/abuse backstop on the raw candidate payload fed into the prompt.
const MAX_CANDIDATES_JSON_LENGTH = 60_000

async function isRateLimited(clientKey: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count, error } = await supabaseAdmin
    .from('nestor_requests')
    .select('*', { count: 'exact', head: true })
    .eq('client_key', clientKey)
    .gte('created_at', since)
  // Fail open — a rate-limit infra hiccup shouldn't take Nestor down.
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: {
      type: 'string',
      description: 'The 1–3 sentence reply that leads the answer.',
    },
    picks: {
      type: 'array',
      description: 'The chosen listings, best first.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Copied exactly from the candidate data.' },
          fit: { type: 'integer', description: 'Holistic 0–100 match against the brief.' },
          strengths: { type: 'array', items: { type: 'string' } },
          tradeoff: { type: 'string' },
          confidenceBasis: { type: 'string' },
        },
        required: ['id', 'fit', 'strengths', 'tradeoff', 'confidenceBasis'],
      },
    },
  },
  required: ['summary', 'picks'],
}

const SYSTEM_PROMPT = `You are Nestor, HomeHuntAI's home decision partner for the Indian property market (Bangalore, Hyderabad, Delhi NCR, Pune). You are given a user's home-search brief, their structured intent, some context, and a JSON array of REAL candidate listings that already pass the hard filters. Choose and rank the best homes and explain each choice like a trusted advisor would.

Respond with JSON:
- summary: a 1–3 sentence reply that leads the answer. Reference what they asked for (city, budget, priorities, life stage) naturally — talk to the user, not about them. If context.refined is true, START with exactly "Updated your search." If context.relaxed is non-empty, briefly note that you loosened those filters to surface enough good options. Plain text only, no markdown.
- picks: the best context.topN listings (fewer only if fewer candidates exist), BEST FIRST. For each pick:
  - id: the listing's id, copied EXACTLY from the candidate data.
  - fit: integer 0–100, your holistic judgment of how well this home matches the brief. Weigh the intent's priorities in their given order (first matters most) using the 0–100 localityScores, plus budget headroom against intent.maxPrice, BHK/size/type match, and concrete details (highlights, amenities, nearby places). Fits must be non-increasing down the ranking. Be discriminating — reserve 90+ for a truly exceptional match.
  - strengths: 2–4 short, specific reasons this home fits THIS brief, each under 100 characters. Ground every claim in the candidate's own data — name the locality, a nearby school/metro/park/hospital with its distance or travel time, a standout amenity or highlight, RERA approval, or price-per-sqft value. Never state the raw 0–100 scores; translate them into plain judgments ("excellent walkability", "very safe pocket").
  - tradeoff: ONE honest drawback as a single sentence, grounded in the data — its weakest dimension relative to the brief, a price near the ceiling, older construction, distance from transit, a smaller area than the alternatives.
  - confidenceBasis: one sentence starting with "Based on", saying what the fit number rests on (top-priority alignment, budget headroom, specifics from the data). If context.usedDefaultPriorities is true, note that the priorities were inferred rather than stated; if context.relaxed is non-empty, note the widened filters.

Hard rules:
- Use ONLY facts present in the candidate data. NEVER invent, estimate, or embellish a fact, number, name, or place.
- Every picks[].id must be one of the candidate ids. No duplicates, no ids from anywhere else.
- NEVER write a raw localityScores number anywhere in the output — no "a family score of 89", no "safety score of 80". Always translate scores into qualitative judgments ("outstanding for families", "a very safe pocket"). Prices, distances, travel times and ages are fine to quote.
- Prices are in rupees. When mentioning an amount, write it in Indian units (₹1.2 Cr, ₹85 L, ₹45k/month) — never raw digits like 12000000.
- Write for a smart buyer: warm, concrete, decisive. No hedging, no filler, no exclamation marks.`

interface ReasonRequest {
  brief: string
  intent: Record<string, unknown>
  candidates: { id?: unknown }[]
  context: {
    refined?: boolean
    relaxed?: string[]
    usedDefaultPriorities?: boolean
    totalMatched?: number
    topN?: number
  }
}

interface GeminiPick {
  id: string
  fit: number
  strengths: string[]
  tradeoff: string
  confidenceBasis: string
}

interface GeminiReasoning {
  summary: string
  picks: GeminiPick[]
}

async function callGemini(prompt: string): Promise<GeminiReasoning> {
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      // Some temperature keeps the prose natural; the schema keeps it honest.
      temperature: 0.35,
      maxOutputTokens: 2048,
    },
  })

  const text = response.text
  if (!text) throw new Error('Gemini returned no content')
  return JSON.parse(text) as GeminiReasoning
}

const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

/**
 * Validate Gemini's output against the candidate set the caller actually
 * sent: unknown/duplicate ids are dropped, fit is clamped to 0–100, strengths
 * are trimmed and capped. Returns null when nothing usable survives, which
 * the handler turns into a 502 so the client falls back deterministically.
 */
function sanitize(
  result: GeminiReasoning,
  candidateIds: Set<string>,
  topN: number,
): GeminiReasoning | null {
  if (typeof result.summary !== 'string' || !result.summary.trim()) return null
  if (!Array.isArray(result.picks)) return null

  const seen = new Set<string>()
  const picks: GeminiPick[] = []
  for (const pick of result.picks) {
    if (picks.length >= topN) break
    if (typeof pick?.id !== 'string' || !candidateIds.has(pick.id) || seen.has(pick.id)) continue
    const strengths = (Array.isArray(pick.strengths) ? pick.strengths : [])
      .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()))
      .map((s) => s.trim())
      .slice(0, 4)
    if (strengths.length === 0) continue
    if (typeof pick.tradeoff !== 'string' || !pick.tradeoff.trim()) continue
    if (typeof pick.confidenceBasis !== 'string' || !pick.confidenceBasis.trim()) continue
    seen.add(pick.id)
    picks.push({
      id: pick.id,
      fit: clamp(Number(pick.fit) || 0),
      strengths,
      tradeoff: pick.tradeoff.trim(),
      confidenceBasis: pick.confidenceBasis.trim(),
    })
  }
  if (picks.length === 0) return null

  return { summary: result.summary.trim(), picks }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!GEMINI_API_KEY) {
    return jsonResponse({ error: 'GEMINI_API_KEY is not configured' }, 500)
  }

  try {
    const { brief, intent, candidates, context } = (await req.json()) as ReasonRequest
    if (typeof brief !== 'string' || !brief.trim()) {
      return jsonResponse({ error: 'brief is required' }, 400)
    }
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return jsonResponse({ error: 'candidates are required' }, 400)
    }
    if (candidates.length > MAX_CANDIDATES) {
      return jsonResponse({ error: 'too many candidates' }, 400)
    }
    const candidateIds = new Set(
      candidates.map((c) => c?.id).filter((id): id is string => typeof id === 'string'),
    )
    if (candidateIds.size !== candidates.length) {
      return jsonResponse({ error: 'every candidate needs a unique id' }, 400)
    }
    const candidatesJson = JSON.stringify(candidates)
    if (candidatesJson.length > MAX_CANDIDATES_JSON_LENGTH) {
      return jsonResponse({ error: 'candidate payload too large' }, 400)
    }

    const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (await isRateLimited(clientKey)) {
      return jsonResponse({ error: 'Rate limit exceeded' }, 429)
    }

    const topN = Math.min(Math.max(Number(context?.topN) || 3, 1), 5)
    const prompt = [
      `User brief: ${JSON.stringify(brief.trim().slice(0, MAX_BRIEF_LENGTH))}`,
      `Structured intent (priorities are most-important-first): ${JSON.stringify(intent ?? {})}`,
      `Context: ${JSON.stringify({
        refined: Boolean(context?.refined),
        relaxed: Array.isArray(context?.relaxed) ? context.relaxed : [],
        usedDefaultPriorities: Boolean(context?.usedDefaultPriorities),
        totalMatched: Number(context?.totalMatched) || candidates.length,
        topN,
      })}`,
      `Candidate listings: ${candidatesJson}`,
    ].join('\n\n')

    const result = sanitize(await callGemini(prompt), candidateIds, topN)
    if (!result) {
      return jsonResponse({ error: 'Gemini returned no usable picks' }, 502)
    }

    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
