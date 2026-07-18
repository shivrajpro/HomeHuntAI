import { useCallback, useEffect, useRef, useState } from 'react'

import { formatINR } from '@/lib/utils'
import type { NestorAnswer } from '@/features/nestor/reasoning'

/**
 * Voice-first Nestor — thin wrappers over the browser's Web Speech APIs so the
 * user can *speak* a brief (SpeechRecognition → dictation) and *hear* the top
 * recommendation read back (SpeechSynthesis → spoken summary). Both are
 * progressive enhancements: when the APIs are missing (Firefox has no
 * SpeechRecognition, some mobile browsers no synthesis), the hooks report
 * `supported: false` and the page simply hides the controls — the typed flow is
 * untouched. No backend, no network: everything runs in the browser.
 */

// --- Web Speech API typings -------------------------------------------------
// `SpeechRecognition` still isn't in TypeScript's DOM lib (it ships prefixed as
// `webkitSpeechRecognition`), so we declare the minimal surface we use.

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

function getRecognitionCtor(): SpeechRecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

// --- Dictation (speech → text) ---------------------------------------------

export interface SpeechInput {
  /** Whether this browser exposes SpeechRecognition at all. */
  supported: boolean
  /** True while the mic is open and transcribing. */
  listening: boolean
  /** The not-yet-final transcript, streamed live so the user sees words form. */
  interim: string
  /** Open the mic. No-op if unsupported or already listening. */
  start(): void
  /** Close the mic; the accumulated transcript is delivered via `onFinal`. */
  stop(): void
}

/**
 * Dictate a brief into text. Interim results stream through `onInterim` (so the
 * composer fills as the user speaks); when the session ends — the user taps
 * stop, or the browser detects a long pause — the finalized transcript is
 * handed to `onFinal`, which the page uses to auto-submit the turn.
 */
export function useSpeechInput({
  onFinal,
  onInterim,
  lang = 'en-IN',
}: {
  onFinal: (text: string) => void
  onInterim?: (text: string) => void
  lang?: string
}): SpeechInput {
  const [supported] = useState(() => getRecognitionCtor() !== undefined)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  // Accumulated final transcript for this session — recognition can fire several
  // `onresult` events, each finalizing a fragment, before it ends.
  const finalRef = useRef('')
  // Latest callbacks, kept in refs so the long-lived recognition handlers never
  // capture a stale closure.
  const onFinalRef = useRef(onFinal)
  const onInterimRef = useRef(onInterim)
  onFinalRef.current = onFinal
  onInterimRef.current = onInterim

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor || recognitionRef.current) return

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    finalRef.current = ''
    setInterim('')

    recognition.onstart = () => setListening(true)

    recognition.onresult = (event) => {
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalRef.current = `${finalRef.current} ${text}`.trim()
        } else {
          live += text
        }
      }
      setInterim(live)
      // Show the caller the full utterance-so-far: finalized words plus the
      // live fragment currently being spoken.
      onInterimRef.current?.(`${finalRef.current} ${live}`.trim())
    }

    recognition.onerror = (event) => {
      // 'no-speech'/'aborted' are ordinary (user paused or tapped stop); only
      // surface nothing — the page keeps whatever was transcribed.
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        // eslint-disable-next-line no-console
        console.warn('SpeechRecognition error:', event.error)
      }
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
      recognitionRef.current = null
      const finalText = finalRef.current.trim()
      finalRef.current = ''
      if (finalText) onFinalRef.current(finalText)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [lang])

  // Abort any open session on unmount so the mic isn't left hot.
  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current
      if (recognition) {
        recognition.onend = null
        recognition.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  return { supported, listening, interim, start, stop }
}

// --- Spoken summary (text → speech) ----------------------------------------

const VOICE_PREF_KEY = 'nestor-voice-reply'

export interface SpeechOutput {
  /** Whether this browser exposes SpeechSynthesis. */
  supported: boolean
  /** User's persisted preference: should Nestor read answers aloud? */
  enabled: boolean
  /** True while an utterance is actively being spoken. */
  speaking: boolean
  /** Flip the auto-read-aloud preference (persisted to localStorage). */
  toggle(): void
  /** Speak text now, cancelling anything already in progress. */
  speak(text: string): void
  /** Stop speaking immediately. */
  cancel(): void
}

/**
 * Read text aloud with SpeechSynthesis. `enabled` is a persisted preference the
 * page consults before auto-reading a fresh answer; `speak()` itself always
 * speaks, so an explicit "Listen" button works even with auto-read off.
 */
export function useSpeechOutput(): SpeechOutput {
  const [supported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window,
  )
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(VOICE_PREF_KEY) === 'true'
  })
  const [speaking, setSpeaking] = useState(false)
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  // Voices load asynchronously in most browsers — cache them as they arrive so
  // `speak()` can pick a good English (ideally Indian-English) voice.
  useEffect(() => {
    if (!supported) return
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
    }
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) return
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-IN'
      utterance.rate = 1.02
      utterance.pitch = 1

      const voices = voicesRef.current
      const preferred =
        voices.find((v) => v.lang === 'en-IN') ??
        voices.find((v) => v.lang === 'en-GB') ??
        voices.find((v) => v.lang.startsWith('en'))
      if (preferred) utterance.voice = preferred

      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)

      window.speechSynthesis.speak(utterance)
    },
    [supported],
  )

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(VOICE_PREF_KEY, String(next))
      }
      // Turning the preference off should silence anything mid-sentence.
      if (!next && typeof window !== 'undefined') {
        window.speechSynthesis.cancel()
        setSpeaking(false)
      }
      return next
    })
  }, [])

  // Stop speaking if the component unmounts (e.g. navigating away from Nestor).
  useEffect(() => {
    if (!supported) return
    return () => window.speechSynthesis.cancel()
  }, [supported])

  return { supported, enabled, speaking, toggle, speak, cancel }
}

// --- Spoken-summary text ----------------------------------------------------

/**
 * Rewrite display text into something a screen-reader voice pronounces
 * naturally: ₹ shorthand becomes spoken words ("₹1.5 Cr" → "1.5 crore rupees")
 * and common abbreviations are expanded. Everything else is left alone.
 */
function speechify(text: string): string {
  return text
    .replace(/₹\s?([\d.]+)\s?cr\b/gi, (_, n) => `${n} crore rupees`)
    .replace(/₹\s?([\d.]+)\s?l\b/gi, (_, n) => `${n} lakh rupees`)
    .replace(/₹\s?([\d.]+)\s?k\b/gi, (_, n) => `${n} thousand rupees`)
    .replace(/₹\s?([\d,]+)/g, (_, n: string) => `${n.replace(/,/g, '')} rupees`)
    .replace(/\/mo\b/gi, ' per month')
    .replace(/\bsq\.?\s?ft\b/gi, 'square feet')
    .replace(/\bkm\b/gi, 'kilometers')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Build the sentence Nestor speaks after a turn. For a real search it leads with
 * the single top pick — price, home, locality, fit and the headline strength —
 * because that first spoken recommendation is the whole point of voice-first:
 * ask out loud, hear a reasoned answer. Off-topic / no-signal turns just speak
 * their short conversational reply.
 */
export function buildSpokenSummary(answer: NestorAnswer): string {
  if (answer.offTopic || answer.noNewSignal || answer.picks.length === 0) {
    return speechify(answer.summary)
  }

  const top = answer.picks[0]
  const home = top.property
  const price =
    formatINR(home.price) + (home.listingType === 'Rent' ? ' per month' : '')
  const count =
    answer.picks.length > 1
      ? `I found ${answer.picks.length} strong matches. `
      : ''
  const location = `${home.subLocality}, ${home.city}`
  const strength = top.strengths[0] ? ` ${top.strengths[0]}.` : ''
  const tradeoff = top.tradeoff ? ` The main trade-off: ${top.tradeoff}` : ''

  return speechify(
    `${count}My top pick is ${home.title}, ${price}, in ${location}. ` +
      `That's a ${top.fit} percent fit.${strength}${tradeoff}`,
  )
}
