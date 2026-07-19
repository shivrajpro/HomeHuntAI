import { Loader2, Plus, X } from 'lucide-react'

import {
  PRIORITY_OPTIONS,
  type PriorityDimension,
} from '@/features/nestor/reasoning'

/**
 * The detected priorities as editable chips. Active chips (ordered by weight,
 * the first counting most) can be removed; remaining dimensions can be added.
 * Any change re-ranks the picks via `onChange`.
 */
export function PriorityEditor({
  active,
  lifestyleTags,
  pending,
  onChange,
}: {
  active: PriorityDimension[]
  lifestyleTags: string[]
  /** A re-rank is in flight — freeze the chips and show a loading hint. */
  pending: boolean
  onChange: (next: PriorityDimension[]) => void
}) {
  const labelFor = (dim: PriorityDimension) =>
    PRIORITY_OPTIONS.find((o) => o.value === dim)?.label ?? dim
  const inactive = PRIORITY_OPTIONS.filter((o) => !active.includes(o.value))

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-tight">Detected priorities</p>
        {pending && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
            <Loader2 className="size-3 animate-spin" />
            Re-ranking picks…
          </span>
        )}
      </div>
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
              disabled={active.length === 1 || pending}
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
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40"
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
