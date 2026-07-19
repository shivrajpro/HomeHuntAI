import { Mic, SendHorizonal, Volume2, VolumeX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from '@/features/nestor/chat'
import type { SpeechInput, SpeechOutput } from '@/features/nestor/use-voice'
import { cn } from '@/lib/utils'

/**
 * The sticky message composer: the brief textarea plus the voice-reply toggle,
 * dictation mic and send button, with the contextual hint line underneath.
 * Purely presentational — all chat state lives in `useNestorChat`.
 */
export function NestorComposer({
  input,
  onInputChange,
  onSend,
  thinking,
  voice,
  dictation,
  onToggleDictation,
}: {
  input: string
  onInputChange: (value: string) => void
  /** Submit the current brief as a turn (also fired by Enter without Shift). */
  onSend: (text: string) => void
  /** A turn is in flight — sending is disabled until it resolves. */
  thinking: boolean
  voice: SpeechOutput
  dictation: SpeechInput
  onToggleDictation: () => void
}) {
  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSend(input)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(input)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      // z-30 keeps the composer above the message list (header/nav are z-40,
      // the compare tray z-50). Without it, the tall answer sliding up under
      // the sticky bar during the post-results smooth scroll hit-tests over
      // the composer — its link overlays (z-10) and "View in Explore" button
      // steal a tap meant for the voice/mic/send controls and navigate away.
      className="sticky bottom-0 z-30 mt-4 bg-background/80 py-3 backdrop-blur-xl"
    >
      <div className="flex items-end gap-2 rounded-2xl border border-border/60 bg-card p-2 shadow-sm focus-within:border-primary/40">
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          maxLength={MAX_QUERY_LENGTH}
          placeholder={
            dictation.listening
              ? 'Listening… speak your brief'
              : 'e.g. 3 BHK to buy in Bangalore under ₹1.5 Cr, family-friendly and safe…'
          }
          className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        {voice.supported && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={voice.toggle}
            aria-pressed={voice.enabled}
            aria-label={
              voice.enabled
                ? 'Voice replies on — Nestor reads answers aloud'
                : 'Voice replies off'
            }
            title={
              voice.enabled ? 'Nestor reads answers aloud' : 'Voice replies off'
            }
            className={cn(
              'text-muted-foreground',
              voice.enabled && 'text-primary',
            )}
          >
            {voice.enabled ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </Button>
        )}
        {dictation.supported && (
          <Button
            type="button"
            size="icon"
            variant={dictation.listening ? 'default' : 'ghost'}
            onClick={onToggleDictation}
            aria-pressed={dictation.listening}
            aria-label={
              dictation.listening ? 'Stop dictation' : 'Speak your brief'
            }
            title={dictation.listening ? 'Stop dictation' : 'Speak your brief'}
            className={cn(
              !dictation.listening && 'text-muted-foreground',
              dictation.listening && 'animate-pulse',
            )}
          >
            <Mic className="size-4" />
          </Button>
        )}
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
        {dictation.listening ? (
          <span className="inline-flex items-center gap-1.5 text-primary">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Listening — tap the mic again when you're done.
          </span>
        ) : input.trim().length > 0 && input.trim().length < MIN_QUERY_LENGTH ? (
          `Type at least ${MIN_QUERY_LENGTH} characters.`
        ) : (
          `Gemini reasons over real listings — picking, ranking and explaining every recommendation.`
        )}
        {!dictation.listening && input.length >= MAX_QUERY_LENGTH * 0.9 && (
          <span className="ml-1 text-muted-foreground/80">
            ({input.length}/{MAX_QUERY_LENGTH})
          </span>
        )}
      </p>
    </form>
  )
}
