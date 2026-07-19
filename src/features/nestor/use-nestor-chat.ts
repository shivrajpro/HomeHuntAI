import { useEffect, useRef, useState } from 'react'

import {
  applyTrace,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  type ChatMessage,
} from '@/features/nestor/chat'
import {
  rerankIntent,
  runNestor,
  type NestorAnswer,
  type NestorIntent,
  type NestorTrace,
  type NestorTraceEvent,
  type PriorityDimension,
} from '@/features/nestor/reasoning'
import {
  buildSpokenSummary,
  useSpeechInput,
  useSpeechOutput,
} from '@/features/nestor/use-voice'

let messageSeq = 0
const nextId = () => `m${messageSeq++}`

/**
 * The Nestor conversation's state machine: the message list, the in-flight
 * turn (with its live reasoning trace), per-turn priority re-ranking, and the
 * voice layer (dictation in, spoken summaries out). The page and its
 * components stay purely presentational over what this returns.
 */
export function useNestorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  // The message id whose picks are being re-ranked after a chip edit, so that
  // exactly that turn (not the whole page) shows a loading state.
  const [rerankingId, setRerankingId] = useState<string | null>(null)
  // The in-flight turn's reasoning trace, streamed live under the composer.
  const [liveTrace, setLiveTrace] = useState<NestorTraceEvent[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  // Structured conversation memory: the last turn's intent, carried forward so
  // follow-ups ("make it cheaper", "only Bangalore") refine instead of reset.
  const lastIntentRef = useRef<NestorIntent | undefined>(undefined)

  // Voice-first: speak a brief in, hear the top pick read back. Both are
  // progressive enhancements — absent APIs simply hide their controls.
  const voice = useSpeechOutput()
  // The message id Nestor is currently reading aloud, so the right "Listen"
  // button can switch to "Stop" (cleared when speech ends).
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  useEffect(() => {
    if (!voice.speaking) setSpeakingId(null)
  }, [voice.speaking])

  const dictation = useSpeechInput({
    // Stream partial words straight into the composer as they're recognised.
    onInterim: (text) => setInput(text),
    // On a finished utterance, submit the turn — ask out loud, get an answer.
    onFinal: (text) => submit(text),
  })

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking])

  async function submit(raw: string) {
    const text = raw.trim()
    if (!text || thinking) return
    if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) return

    // A new turn interrupts anything Nestor is still reading aloud.
    voice.cancel()
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
    const assistantId = nextId()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', text: answer.summary, answer, trace },
    ])
    setThinking(false)
    setLiveTrace([])

    // Read the recommendation back when the user has voice replies switched on.
    if (voice.enabled) {
      voice.speak(buildSpokenSummary(answer))
      setSpeakingId(assistantId)
    }
  }

  // Speak a past answer on demand, or stop it if it's the one already playing.
  function toggleSpeak(messageId: string, answer: NestorAnswer) {
    if (speakingId === messageId && voice.speaking) {
      voice.cancel()
      return
    }
    voice.speak(buildSpokenSummary(answer))
    setSpeakingId(messageId)
  }

  function toggleDictation() {
    if (dictation.listening) {
      dictation.stop()
    } else {
      voice.cancel()
      dictation.start()
    }
  }

  // Re-rank a past answer after its priority chips are edited, in place.
  async function editPriorities(
    messageId: string,
    priorities: PriorityDimension[],
  ) {
    // Ignore repeat clicks while a re-rank is already in flight for any turn.
    if (rerankingId) return
    const target = messages.find((m) => m.id === messageId)
    if (!target?.answer) return

    // Reflect the toggled chip straight away — the click registers visibly
    // without waiting on the round-trip — and mark this turn as in-flight so
    // its editor and picks show a loading state.
    setRerankingId(messageId)
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.answer
          ? { ...m, answer: { ...m.answer, intent: { ...m.answer.intent, priorities } } }
          : m,
      ),
    )

    const trace: NestorTraceEvent[] = []
    const onTrace: NestorTrace = (event) => {
      const next = applyTrace(trace, event)
      trace.length = 0
      trace.push(...next)
    }

    try {
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
    } finally {
      setRerankingId(null)
    }
  }

  return {
    messages,
    input,
    setInput,
    thinking,
    liveTrace,
    rerankingId,
    speakingId,
    scrollRef,
    voice,
    dictation,
    submit,
    editPriorities,
    toggleSpeak,
    toggleDictation,
  }
}
