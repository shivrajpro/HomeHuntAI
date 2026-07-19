import { ScoreBar } from '@/components/ui/score-bar'
import type { Property } from '@/features/properties/types'

const INSIGHT_LABELS: Record<keyof Property['aiInsights'], string> = {
  walkability: 'Walkability',
  familyScore: 'Family friendly',
  investmentScore: 'Investment',
  commuteScore: 'Commute',
  safetyScore: 'Safety',
  nightlifeScore: 'Nightlife',
  greenScore: 'Green cover',
}

/** The AI-scored locality breakdown card shown in the detail page's sidebar. */
export function NeighborhoodIntel({ property }: { property: Property }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <h2 className="text-sm font-medium tracking-tight">Neighborhood intel</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        AI-scored for {property.subLocality}
      </p>
      <div className="mt-4 space-y-3">
        {(Object.keys(INSIGHT_LABELS) as (keyof Property['aiInsights'])[]).map(
          (key) => (
            <ScoreBar
              key={key}
              label={INSIGHT_LABELS[key]}
              score={property.aiInsights[key]}
            />
          ),
        )}
      </div>
    </div>
  )
}
