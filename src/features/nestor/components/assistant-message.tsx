import { useNavigate } from 'react-router-dom'
import { FileText, SlidersHorizontal, Square, Volume2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { filtersToParams } from '@/features/properties/filter-params'
import type { ChatMessage } from '@/features/nestor/chat'
import {
  intentToFilters,
  type PriorityDimension,
} from '@/features/nestor/reasoning'
import { cn } from '@/lib/utils'

import { ScopeFallback } from './empty-states'
import { NestorAvatar } from './message-primitives'
import { NestorThinking } from './nestor-thinking'
import { PickCard } from './pick-card'
import { PriorityEditor } from './priority-editor'
import { RejectedSection } from './rejected-section'
import { TradeoffSimulator } from './tradeoff-simulator'

/**
 * One assistant turn: the reasoning trace, the summary (or scope redirect),
 * the editable priorities, the ranked picks with their actions, the trade-off
 * simulator and the near-miss disclosure — everything a `NestorAnswer` carries.
 */
export function AssistantMessage({
  message,
  reranking,
  onEditPriorities,
  onPickExample,
  onToggleSpeak,
  isSpeaking,
  voiceSupported,
}: {
  message: ChatMessage
  /** Whether this turn's picks are being re-ranked after a chip edit. */
  reranking: boolean
  onEditPriorities: (priorities: PriorityDimension[]) => void
  onPickExample: (brief: string) => void
  /** Speak this answer aloud, or stop it if it's the one currently speaking. */
  onToggleSpeak: () => void
  isSpeaking: boolean
  voiceSupported: boolean
}) {
  const navigate = useNavigate()
  const { answer } = message
  // Offer a spoken read-out for any substantive turn (a redirect or bare
  // acknowledgment isn't worth a button).
  const canSpeak =
    voiceSupported && !!answer && !answer.offTopic && !answer.noNewSignal

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
      <NestorAvatar />
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
            pending={reranking}
            onChange={onEditPriorities}
          />
        )}
        {answer && answer.picks.length > 0 && (
          <div
            className={cn(
              'space-y-2 transition-opacity',
              reranking && 'pointer-events-none opacity-50',
            )}
            aria-busy={reranking}
          >
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
            {canSpeak && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onToggleSpeak}
                aria-label={isSpeaking ? 'Stop reading aloud' : 'Read this answer aloud'}
                className={cn(
                  'text-muted-foreground',
                  isSpeaking && 'border-primary/40 text-primary',
                )}
              >
                {isSpeaking ? (
                  <Square className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
                {isSpeaking ? 'Stop' : 'Listen'}
              </Button>
            )}
          </div>
        )}
        {answer &&
          answer.picks.length > 0 &&
          answer.simulatorHomes &&
          answer.simulatorHomes.length > 1 && (
            <TradeoffSimulator
              // Remount when the priority set or budget changes (e.g. a chip
              // edit) so the sliders re-seed from the new defaults.
              key={`${answer.intent.priorities.join(',')}|${answer.intent.maxPrice ?? ''}`}
              pool={answer.simulatorHomes}
              intent={answer.intent}
              pickIds={new Set(answer.picks.map((p) => p.property.id))}
            />
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
