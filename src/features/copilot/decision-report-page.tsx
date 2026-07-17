import type { ComponentType, ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Check,
  ClipboardList,
  Compass,
  Scale,
  Sparkles,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { buildDecisionReport } from '@/features/copilot/decision-report'
import type { CopilotAnswer } from '@/features/copilot/reasoning'
import { formatINR } from '@/lib/utils'
import { useDocumentTitle } from '@/lib/use-document-title'

interface LocationState {
  answer?: CopilotAnswer
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  )
}

export function DecisionReportPage() {
  useDocumentTitle('Decision Report · HomeHunt AI')
  const location = useLocation()
  const state = location.state as LocationState | null

  if (!state?.answer) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-center">
        <div className="max-w-sm space-y-4">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">No report to show</h1>
          <p className="text-muted-foreground">
            Decision reports are generated from a Copilot search. Start a conversation to
            get one.
          </p>
          <Button asChild>
            <Link to="/copilot">Go to Copilot</Link>
          </Button>
        </div>
      </div>
    )
  }

  const report = buildDecisionReport(state.answer)
  const top = report.topPick

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="mx-auto max-w-3xl space-y-6"
    >
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/copilot">
          <ArrowLeft className="size-4" />
          Back to Copilot
        </Link>
      </Button>

      <header className="space-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="size-3" />
          Decision Report
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Your home decision, summarised
        </h1>
        <p className="text-pretty text-muted-foreground">&ldquo;{report.brief}&rdquo;</p>
      </header>

      <Section icon={ClipboardList} title="User Requirements">
        <ul className="space-y-1.5">
          {report.requirements.map((r) => (
            <li key={r} className="text-sm text-muted-foreground">
              {r}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Compass} title="AI Understanding">
        <ul className="space-y-1.5">
          {report.understanding.map((u) => (
            <li key={u} className="text-sm text-muted-foreground">
              {u}
            </li>
          ))}
        </ul>
      </Section>

      {top && (
        <Section icon={Award} title="Top Recommendation">
          <Link
            to={`/property/${top.property.id}`}
            className="flex gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/40"
          >
            <img
              src={top.property.images[0]}
              alt={top.property.title}
              className="size-20 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0">
              <p className="font-semibold tracking-tight">
                {formatINR(top.property.price)}
                {top.property.listingType === 'Rent' && (
                  <span className="text-sm font-normal text-muted-foreground"> /mo</span>
                )}
              </p>
              <p className="line-clamp-1 text-sm font-medium">{top.property.title}</p>
              <p className="text-xs text-muted-foreground">
                {top.property.subLocality}, {top.property.city}
              </p>
              <p className="mt-1 text-xs font-semibold text-primary">{top.fit}% fit</p>
            </div>
          </Link>
        </Section>
      )}

      <Section icon={Check} title="Strengths">
        <ul className="space-y-1.5">
          {report.strengths.map((s) => (
            <li key={s} className="flex items-start gap-1.5 text-sm text-foreground">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Scale} title="Trade-offs">
        <ul className="space-y-1.5">
          {report.tradeoffs.map((t) => (
            <li key={t} className="text-sm text-muted-foreground">
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {report.alternatives.length > 0 && (
        <Section icon={Sparkles} title="Alternative Options">
          <div className="space-y-2">
            {report.alternatives.map(({ pick, note }) => (
              <Link
                key={pick.property.id}
                to={`/property/${pick.property.id}`}
                className="flex items-center gap-3 rounded-xl border border-border/50 p-2.5 transition-colors hover:border-primary/40"
              >
                <img
                  src={pick.property.images[0]}
                  alt={pick.property.title}
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{pick.property.title}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{note}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {pick.fit}% fit
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section icon={Award} title="Final Recommendation">
        <p className="text-sm leading-relaxed text-foreground">{report.finalRecommendation}</p>
      </Section>
    </motion.div>
  )
}
