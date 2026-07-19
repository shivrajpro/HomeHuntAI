/**
 * Nestor's reasoning engine — the public API. A first message is classified
 * in-scope vs. out-of-scope locally before anything else runs; in-scope
 * intent parsing is delegated to Gemini via the `nestor-intent` Supabase Edge
 * Function with a regex-based parser as the offline fallback (`intent.ts`).
 * Downstream of intent, hard constraints and a weighted locality-score fit
 * deterministically shortlist the strongest candidates (`ranking.ts`), then
 * the hydrated shortlist goes to the `nestor-reason` Edge Function where
 * Gemini picks, ranks and explains end-to-end (`remote.ts`) — every returned
 * id validated against the candidates we sent, falling back to the
 * deterministic ranking and text builders (`narration.ts`) on any failure.
 * `pipeline.ts` orchestrates the stages and streams the live reasoning trace.
 */

export {
  PRIORITY_OPTIONS,
  type PriorityDimension,
} from './dimensions'
export type {
  NestorAnswer,
  NestorIntent,
  NestorTrace,
  NestorTraceEvent,
  NestorTraceStep,
  RankedPick,
  RejectedPick,
} from './types'
export {
  deriveIntent,
  deriveIntentAsync,
  EXAMPLE_BRIEFS,
  intentToFilters,
  isLikelyOutOfScope,
  parseIntent,
} from './intent'
export { rerankIntent, runNestor } from './pipeline'
