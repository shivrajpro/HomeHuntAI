import { cn } from '@/lib/utils'

/** A labelled 0–100 score bar; color ramps from muted to primary with strength. */
export function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            score >= 75 ? 'bg-primary' : score >= 50 ? 'bg-warning' : 'bg-muted-foreground/40',
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}
