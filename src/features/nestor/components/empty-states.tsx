import { Sparkles } from 'lucide-react'

import { EXAMPLE_BRIEFS } from '@/features/nestor/reasoning'
import { cn } from '@/lib/utils'

/**
 * The two "no picks to show" states: the first-visit empty state and the
 * out-of-scope fallback. Both share the same visual pattern (heading,
 * secondary line, example-brief chip grid), with copy sized to the moment.
 */

/** One tappable example brief — picking it submits that brief as a turn. */
function BriefChip({
  brief,
  onPick,
  size,
}: {
  brief: string
  onPick: (brief: string) => void
  size: 'xs' | 'sm'
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(brief)}
      className={cn(
        'rounded-xl border border-border/60 bg-card p-3 text-left text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-primary/40',
        size === 'xs' ? 'text-xs' : 'text-sm',
      )}
    >
      {brief}
    </button>
  )
}

export function EmptyState({ onPick }: { onPick: (brief: string) => void }) {
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
          <BriefChip key={brief} brief={brief} onPick={onPick} size="sm" />
        ))}
      </div>
    </div>
  )
}

/**
 * The out-of-scope fallback — reuses `EmptyState`'s visual pattern (icon,
 * heading, secondary line, chip grid) but with copy that explains the
 * Nestor's scope, for when a brief was classified out-of-scope. Renders no
 * property cards, per the classifier's contract.
 */
export function ScopeFallback({ onPick }: { onPick: (brief: string) => void }) {
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
            <BriefChip key={brief} brief={brief} onPick={onPick} size="xs" />
          ))}
        </div>
      </div>
    </div>
  )
}
