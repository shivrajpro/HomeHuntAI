import type { NestorAnswer, NestorTraceEvent } from '@/features/nestor/reasoning'

/**
 * The chat-turn model shared by the Nestor page, its hook and its components:
 * one message per turn, with the assistant's structured answer and the
 * reasoning trace that produced it.
 */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  answer?: NestorAnswer
  /** The reasoning trace this turn produced — powers the "Nestor's thinking" panel. */
  trace?: NestorTraceEvent[]
}

/** Upsert a trace event by step, preserving arrival order — the live reducer. */
export function applyTrace(
  steps: NestorTraceEvent[],
  event: NestorTraceEvent,
): NestorTraceEvent[] {
  const i = steps.findIndex((s) => s.step === event.step)
  if (i < 0) return [...steps, event]
  const next = steps.slice()
  next[i] = event
  return next
}

// Keep in sync with MAX_RAW_TEXT_LENGTH in supabase/functions/nestor-intent —
// this just surfaces that server-side cutoff in the UI instead of silently
// truncating. MIN_QUERY_LENGTH blocks near-empty noise before it costs a
// classification pass at all.
export const MIN_QUERY_LENGTH = 5
export const MAX_QUERY_LENGTH = 500
