import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  Brain,
  Check,
  ChevronDown,
  FileText,
  Loader2,
  MapPin,
  Plus,
  Scale,
  SendHorizonal,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ScoreBar } from '@/components/ui/score-bar'
import { filtersToParams } from '@/features/properties/filter-params'
import { buildFitMeter } from '@/features/nestor/fit-meter'
import {
  EXAMPLE_BRIEFS,
  intentToFilters,
  PRIORITY_OPTIONS,
  rerankIntent,
  runNestor,
  type NestorAnswer,
  type NestorIntent,
  type NestorTrace,
  type NestorTraceEvent,
  type PriorityDimension,
  type RankedPick,
  type RejectedPick,
} from '@/features/nestor/reasoning'
import { cn, formatINR } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/use-document-title'

/**
 * Nestor — a chat-style front end over `reasoning.ts`. The user describes
 * what they want in plain language; Gemini (via Supabase Edge Functions)
 * parses the brief into a structured intent, then reasons over a
 * deterministically shortlisted set of real candidate listings to pick, rank
 * and explain the recommendations — falling back to the local parser and
 * deterministic ranking independently if either call is unavailable. Picks
 * deep-link into the property detail pages.
 */

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  answer?: NestorAnswer
  /** The reasoning trace this turn produced — powers the "Nestor's thinking" panel. */
  trace?: NestorTraceEvent[]
}

/** Upsert a trace event by step, preserving arrival order — the live reducer. */
function applyTrace(
  steps: NestorTraceEvent[],
  event: NestorTraceEvent,
): NestorTraceEvent[] {
  const i = steps.findIndex((s) => s.step === event.step)
  if (i < 0) return [...steps, event]
  const next = steps.slice()
  next[i] = event
  return next
}

/** Tailwind class for a fit badge — greener the better. */
function fitTone(fit: number): string {
  if (fit >= 80) return 'bg-success/15 text-success'
  if (fit >= 65) return 'bg-primary/15 text-primary'
  return 'bg-warning/15 text-warning'
}

function PickCard({
  pick,
  rank,
  intent,
}: {
  pick: RankedPick
  rank: number
  intent: NestorIntent
}) {
  const { property, fit, strengths, tradeoff, confidenceBasis } = pick
  const isRent = property.listingType === 'Rent'
  const [showFitMeter, setShowFitMeter] = useState(false)
  const fitBars = buildFitMeter(property, intent)

  return (
    <div className="group relative flex gap-3 rounded-xl border border-border/60 bg-background p-3 transition-colors hover:border-primary/40 focus-within:border-primary/40">
      <Link
        to={`/property/${property.id}`}
        aria-label={property.title}
        className="absolute inset-0 z-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <div className="relative size-24 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-28">
        <img
          src={property.images[0]}
          alt={property.title}
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        <span className="absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-background/90 text-[11px] font-semibold text-foreground">
          {rank}
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">
              {formatINR(property.price)}
              {isRent && (
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  /mo
                </span>
              )}
            </p>
            <h4 className="mt-0.5 line-clamp-1 text-sm font-medium tracking-tight">
              {property.title}
            </h4>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="line-clamp-1">
                {property.subLocality}, {property.city}
              </span>
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${fitTone(
              fit,
            )}`}
          >
            <Sparkles className="size-3" />
            {fit}% fit
          </span>
        </div>

        {/* Why this home — qualitative strengths, scores kept internal. */}
        <ul className="mt-2.5 space-y-1">
          {strengths.map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-xs text-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-success" />
              <span>{s}</span>
            </li>
          ))}
        </ul>

        {/* The honest trade-off. */}
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Scale className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{tradeoff}</span>
        </p>

        {/* Confidence: the fit % plus what it's based on. */}
        <p className="mt-1.5 flex items-start gap-1.5 border-t border-border/50 pt-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3 shrink-0 text-primary/70" />
          <span className="line-clamp-2">{confidenceBasis}</span>
        </p>

        {/* Visual fit meter — Overall Fit % (above) plus a breakdown, collapsed by default. */}
        <button
          type="button"
          onClick={() => setShowFitMeter((v) => !v)}
          aria-expanded={showFitMeter}
          className="relative z-20 mt-1.5 flex items-center gap-1 self-start text-[11px] font-medium text-primary outline-none"
        >
          <BarChart3 className="size-3" />
          {showFitMeter ? 'Hide fit breakdown' : 'Fit breakdown'}
          <ChevronDown
            className={cn(
              'size-3 transition-transform',
              showFitMeter && 'rotate-180',
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {showFitMeter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-20 overflow-hidden"
            >
              <div className="mt-2 space-y-2 rounded-lg bg-muted/30 p-2.5">
                {fitBars.map((bar) => (
                  <ScoreBar key={bar.key} label={bar.label} score={bar.score} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ArrowUpRight className="size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}

/**
 * The detected priorities as editable chips. Active chips (ordered by weight,
 * the first counting most) can be removed; remaining dimensions can be added.
 * Any change re-ranks the picks via `onChange`.
 */
function PriorityEditor({
  active,
  lifestyleTags,
  onChange,
}: {
  active: PriorityDimension[]
  lifestyleTags: string[]
  onChange: (next: PriorityDimension[]) => void
}) {
  const labelFor = (dim: PriorityDimension) =>
    PRIORITY_OPTIONS.find((o) => o.value === dim)?.label ?? dim
  const inactive = PRIORITY_OPTIONS.filter((o) => !active.includes(o.value))

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="text-xs font-medium tracking-tight">Detected priorities</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Ordered by importance — the first counts most. Tap to adjust and re-rank.
      </p>
      {lifestyleTags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-b border-border/50 pb-2.5 text-[11px]">
          <span className="text-muted-foreground">Read from your lifestyle:</span>
          {lifestyleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-background px-2 py-0.5 font-medium text-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {active.map((dim) => (
          <span
            key={dim}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
          >
            {labelFor(dim)}
            <button
              type="button"
              onClick={() => onChange(active.filter((d) => d !== dim))}
              disabled={active.length === 1}
              aria-label={`Remove ${labelFor(dim)}`}
              className="grid size-4 place-items-center rounded-full text-primary/70 transition-colors hover:bg-primary/15 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
      {inactive.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {inactive.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange([...active, o.value])}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-primary/40"
            >
              <Plus className="size-3" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * "Why wasn't this recommended?" — a disclosure listing strong homes that
 * missed by a single hard constraint, each with the reason. Helps the user
 * decide whether a constraint is worth flexing, rather than trusting a black box.
 */
function RejectedSection({ rejected }: { rejected: RejectedPick[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left outline-none"
      >
        <span className="text-xs font-medium tracking-tight">
          Why weren't these recommended?
          <span className="ml-1 text-muted-foreground">({rejected.length})</span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-1 text-[11px] text-muted-foreground">
              Strong on fit, but each misses one thing you asked for.
            </p>
            <div className="space-y-1.5 px-3 pb-3">
              {rejected.map((r) => (
                <Link
                  key={r.property.id}
                  to={`/property/${r.property.id}`}
                  className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-background p-2 outline-none transition-colors hover:border-primary/40 focus-visible:border-primary/40"
                >
                  <img
                    src={r.property.images[0]}
                    alt={r.property.title}
                    loading="lazy"
                    className="size-11 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="line-clamp-1 text-xs font-medium tracking-tight">
                        {r.property.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {r.fit}% fit
                      </span>
                    </div>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-warning">
                      <X className="size-3 shrink-0" />
                      <span className="line-clamp-1">{r.reason}</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The out-of-scope fallback — reuses `EmptyState`'s visual pattern (icon,
 * heading, secondary line, chip grid) but with copy that explains the
 * Nestor's scope, for when a brief was classified out-of-scope. Renders no
 * property cards, per the classifier's contract.
 */
function ScopeFallback({ onPick }: { onPick: (brief: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h2 className="text-sm font-semibold leading-relaxed tracking-tight">
          I'm Nestor — HomeHuntAI's home decision partner, focused on
          Bangalore, Hyderabad, Greater Delhi Area, and Pune.
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          I help you discover real homes to buy or rent based on your city,
          budget and priorities.
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Try something like:
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXAMPLE_BRIEFS.slice(0, 4).map((brief) => (
            <button
              key={brief}
              type="button"
              onClick={() => onPick(brief)}
              className="rounded-xl border border-border/60 bg-card p-3 text-left text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-primary/40"
            >
              {brief}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function AssistantMessage({
  message,
  onEditPriorities,
  onPickExample,
}: {
  message: ChatMessage
  onEditPriorities: (priorities: PriorityDimension[]) => void
  onPickExample: (brief: string) => void
}) {
  const navigate = useNavigate()
  const { answer } = message

  function openInExplore() {
    if (!answer) return
    const params = filtersToParams(intentToFilters(answer.intent))
    navigate(`/explore?${params.toString()}`)
  }

  function openDecisionReport() {
    if (!answer) return
    navigate('/decision-report', { state: { answer } })
  }

  return (
    <div className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        {answer && !answer.offTopic && !answer.noNewSignal && message.trace?.length ? (
          <NestorThinking steps={message.trace} />
        ) : null}
        {answer?.offTopic ? (
          <ScopeFallback onPick={onPickExample} />
        ) : (
          <p className="text-sm leading-relaxed text-foreground">{message.text}</p>
        )}
        {answer && !answer.offTopic && !answer.noNewSignal && (
          <PriorityEditor
            active={answer.intent.priorities}
            lifestyleTags={answer.intent.lifestyleTags}
            onChange={onEditPriorities}
          />
        )}
        {answer && answer.picks.length > 0 && (
          <div className="space-y-2">
            {answer.picks.map((pick, i) => (
              <PickCard
                key={pick.property.id}
                pick={pick}
                rank={i + 1}
                intent={answer.intent}
              />
            ))}
          </div>
        )}
        {answer && answer.picks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openInExplore}
              className="text-muted-foreground"
            >
              <SlidersHorizontal className="size-4" />
              View these in Explore
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openDecisionReport}
              className="text-muted-foreground"
            >
              <FileText className="size-4" />
              View Decision Report
            </Button>
          </div>
        )}
        {answer && answer.rejected.length > 0 && (
          <RejectedSection rejected={answer.rejected} />
        )}
        {answer &&
          !answer.offTopic &&
          !answer.noNewSignal &&
          answer.picks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              I couldn't find anything matching that. Try widening the budget
              or city.
            </p>
          )}
      </div>
    </div>
  )
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] cursor-text select-text rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground selection:bg-primary-foreground/30 selection:text-primary-foreground">
        {text}
      </p>
    </div>
  )
}

/** A single step in the reasoning timeline — spinner while active, check when done. */
function TraceRow({ event, last }: { event: NestorTraceEvent; last: boolean }) {
  const active = event.status === 'active'
  return (
    <li className="relative flex gap-2.5 pl-0.5">
      {/* Rail: the connecting line + the status node. */}
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full',
            active ? 'bg-primary/10 text-primary' : 'bg-success/15 text-success',
          )}
        >
          {active ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3" />
          )}
        </span>
        {!last && <span className="w-px flex-1 bg-border/70" />}
      </div>
      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-2.5')}>
        <p
          className={cn(
            'text-xs font-medium tracking-tight',
            active ? 'text-foreground' : 'text-foreground/90',
          )}
        >
          {event.label}
        </p>
        {event.detail && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {event.detail}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * "Nestor's thinking" — the live reasoning trace. Streams the real pipeline
 * (scope → intent → catalogue scan → filter → shortlist → reasoning →
 * validation) as it runs, so the recommendation reads as the outcome of
 * visible work rather than a black box. While `live`, it stays expanded and
 * shows a spinner; once the turn is done it collapses into a thin, replayable
 * disclosure — collapsed by default so it never competes with the picks.
 */
function NestorThinking({
  steps,
  live = false,
}: {
  steps: NestorTraceEvent[]
  live?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (steps.length === 0) return null

  const expanded = live || open
  const done = steps.filter((s) => s.status === 'done').length

  const header = (
    <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Brain className="size-3.5" />
      </span>
      <span className="text-xs font-medium tracking-tight">Nestor's thinking</span>
      {live ? (
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          reasoning…
        </span>
      ) : (
        <>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {done} step{done === 1 ? '' : 's'}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </>
      )}
    </div>
  )

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20">
      {live ? (
        header
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full outline-none"
        >
          {header}
        </button>
      )}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={live ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ol className="px-3 pb-3">
              {steps.map((event, i) => (
                <TraceRow
                  key={event.step}
                  event={event}
                  last={i === steps.length - 1}
                />
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </div>
      <div className="flex items-center gap-1 pt-2.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onPick }: { onPick: (brief: string) => void }) {
  return (
    <div className="space-y-6 py-6">
      <div className="space-y-3 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tell me what home you're after
        </h1>
        <p className="mx-auto max-w-md text-muted-foreground">
          Describe your budget, city, life stage and what matters to you. I'll
          rank real listings by fit and explain the trade-offs.
        </p>
      </div>
      <div className="mx-auto grid max-w-2xl gap-2 sm:grid-cols-2">
        {EXAMPLE_BRIEFS.map((brief) => (
          <button
            key={brief}
            type="button"
            onClick={() => onPick(brief)}
            className="rounded-xl border border-border/60 bg-card p-3 text-left text-sm text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-primary/40"
          >
            {brief}
          </button>
        ))}
      </div>
    </div>
  )
}

let messageSeq = 0
const nextId = () => `m${messageSeq++}`

// Keep in sync with MAX_RAW_TEXT_LENGTH in supabase/functions/nestor-intent —
// this just surfaces that server-side cutoff in the UI instead of silently
// truncating. MIN_QUERY_LENGTH blocks near-empty noise before it costs a
// classification pass at all.
const MIN_QUERY_LENGTH = 5
const MAX_QUERY_LENGTH = 500

export function NestorPage() {
  useDocumentTitle('Ask Nestor · HomeHunt AI')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  // The in-flight turn's reasoning trace, streamed live under the composer.
  const [liveTrace, setLiveTrace] = useState<NestorTraceEvent[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  // Structured conversation memory: the last turn's intent, carried forward so
  // follow-ups ("make it cheaper", "only Bangalore") refine instead of reset.
  const lastIntentRef = useRef<NestorIntent | undefined>(undefined)

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  async function submit(raw: string) {
    const text = raw.trim()
    if (!text || thinking) return
    if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) return

    setMessages((prev) => [...prev, { id: nextId(), role: 'user', text }])
    setInput('')
    setThinking(true)
    setLiveTrace([])

    // Collect the trace into a local array (no stale-closure risk after the
    // awaits) while mirroring it into state so the live panel streams.
    const trace: NestorTraceEvent[] = []
    const onTrace: NestorTrace = (event) => {
      const next = applyTrace(trace, event)
      trace.length = 0
      trace.push(...next)
      setLiveTrace(next)
    }

    // Two Gemini calls behind one await: intent parsing, then reasoning over
    // the candidate shortlist — each degrades to its local fallback on error.
    const answer = await runNestor(text, lastIntentRef.current, 3, onTrace)
    // Don't carry an off-topic turn's (empty) intent forward — doing so would
    // make the *next* message look like a follow-up to an established search
    // instead of a fresh first turn, silently disabling off-topic detection.
    if (!answer.offTopic) lastIntentRef.current = answer.intent
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: 'assistant', text: answer.summary, answer, trace },
    ])
    setThinking(false)
    setLiveTrace([])
  }

  // Re-rank a past answer after its priority chips are edited, in place.
  async function editPriorities(
    messageId: string,
    priorities: PriorityDimension[],
  ) {
    const target = messages.find((m) => m.id === messageId)
    if (!target?.answer) return

    const trace: NestorTraceEvent[] = []
    const onTrace: NestorTrace = (event) => {
      const next = applyTrace(trace, event)
      trace.length = 0
      trace.push(...next)
    }

    const answer = await rerankIntent(
      {
        ...target.answer.intent,
        priorities,
        usedDefaultPriorities: false,
      },
      3,
      onTrace,
    )
    lastIntentRef.current = answer.intent
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, text: answer.summary, answer, trace } : m,
      ),
    )
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      <div className="flex-1">
        {isEmpty ? (
          <EmptyState onPick={submit} />
        ) : (
          <div className="space-y-6 py-2">
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {m.role === 'user' ? (
                    <UserMessage text={m.text} />
                  ) : (
                    <AssistantMessage
                      message={m}
                      onEditPriorities={(priorities) =>
                        editPriorities(m.id, priorities)
                      }
                      onPickExample={submit}
                    />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {thinking &&
              (liveTrace.length > 0 ? (
                <div className="flex gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <NestorThinking steps={liveTrace} live />
                  </div>
                </div>
              ) : (
                <ThinkingIndicator />
              ))}
            <div ref={scrollRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 mt-4 bg-background/80 py-3 backdrop-blur-xl"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-sm focus-within:border-primary/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="e.g. 3 BHK to buy in Bangalore under ₹1.5 Cr, family-friendly and safe…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button
            type="submit"
            size="icon"
            disabled={
              !input.trim() ||
              input.trim().length < MIN_QUERY_LENGTH ||
              thinking
            }
            aria-label="Send"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-center text-xs text-muted-foreground">
          {input.trim().length > 0 && input.trim().length < MIN_QUERY_LENGTH
            ? `Type at least ${MIN_QUERY_LENGTH} characters.`
            : `Gemini reasons over real listings — picking, ranking and explaining every recommendation.`}
          {input.length >= MAX_QUERY_LENGTH * 0.9 && (
            <span className="ml-1 text-muted-foreground/80">
              ({input.length}/{MAX_QUERY_LENGTH})
            </span>
          )}
        </p>
      </form>
    </div>
  )
}
