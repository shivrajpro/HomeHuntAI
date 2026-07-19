import type {
  ListingType,
  Property,
  PropertyType,
  Region,
} from '@/features/properties/types'

import type { Dimension } from './dimensions'

/**
 * The shared shapes a Nestor turn flows through: the structured intent parsed
 * from a brief, the ranked/rejected picks the answer carries, the answer
 * itself, and the live reasoning-trace events the pipeline streams to the UI.
 */

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
  /**
   * Which engine produced this turn's picks and explanation text: 'gemini'
   * when the `nestor-reason` Edge Function answered, 'local' when the
   * deterministic fallback ranked instead. Unset on `offTopic`/`noNewSignal`
   * turns, which carry no picks at all.
   */
  reasonedBy?: 'gemini' | 'local'
  /**
   * The full hydrated shortlist this turn ranked (the ~12 candidates Gemini
   * chose from, picks included). Kept so the client-side trade-off simulator
   * can re-rank a real pool of homes live — dragging budget or a priority
   * weight can promote a candidate above the current top picks — with no extra
   * network or Gemini call. Absent on `offTopic`/`noNewSignal` turns.
   */
  simulatorHomes?: Property[]
}

// --- Live reasoning trace ("Nestor's thinking") ----------------------------
// The pipeline in `runNestor` is a sequence of awaited stages; each stage
// reports itself through an optional `NestorTrace` callback the moment it
// starts and finishes, so the UI can stream the real work (scope → intent →
// catalogue scan → filter → shortlist → reasoning → validation) as it happens
// rather than showing an opaque spinner. The trace is purely observational —
// it never changes what the pipeline produces, and every number it surfaces is
// the actual count that stage worked with.

/** The ordered stages of a Nestor turn, in the sequence they run. */
export type NestorTraceStep =
  | 'scope'
  | 'intent'
  | 'catalogue'
  | 'filter'
  | 'shortlist'
  | 'reason'
  | 'validate'

export interface NestorTraceEvent {
  step: NestorTraceStep
  /** `active` when the stage begins, `done` when it finishes. */
  status: 'active' | 'done'
  /** Short present/past-tense label, e.g. "Scanning listings" / "Listings scanned". */
  label: string
  /** The concrete result of the stage, e.g. "2,000 in range", "top 12". */
  detail?: string
}

/** A sink the pipeline pushes trace events into as each stage runs. */
export type NestorTrace = (event: NestorTraceEvent) => void
