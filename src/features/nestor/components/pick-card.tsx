import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  MapPin,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { useCompare } from '@/features/properties/compare-context'
import { buildFitMeter, fitTier, type FitMeterBar } from '@/features/nestor/fit-meter'
import type { NestorIntent, RankedPick } from '@/features/nestor/reasoning'
import { cn, formatINR } from '@/lib/utils'

import { fitTone, tierTone } from './fit-tones'

/**
 * One dimension of the fit breakdown: a qualitative tier ("Excellent") plus a
 * concrete caption ("₹54 L under your ₹90 L budget") so the bar reads as
 * meaning, not a bare 0–100. Factors the user asked for are flagged and lead.
 */
function FitBar({ bar }: { bar: FitMeterBar }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-xs font-medium text-foreground">{bar.label}</span>
          {bar.prioritized && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">
              You prioritised
            </span>
          )}
        </div>
        <span className={cn('shrink-0 text-[11px] font-semibold', tierTone(bar.score))}>
          {fitTier(bar.score)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            bar.score >= 75
              ? 'bg-primary'
              : bar.score >= 50
                ? 'bg-warning'
                : 'bg-muted-foreground/40',
          )}
          style={{ width: `${bar.score}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{bar.caption}</p>
    </div>
  )
}

export function PickCard({
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
  const { isSelected, toggle: toggleCompare, canAdd, compareType } = useCompare()
  const comparing = isSelected(property.id)
  const addable = canAdd(property.listingType)

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

        {/* Actions — expand the fit breakdown, or add this home to the compare tray. */}
        <div className="relative z-20 mt-1.5 flex items-center gap-3">
          {/* Visual fit meter — Overall Fit % (above) plus a breakdown, collapsed by default. */}
          <button
            type="button"
            onClick={() => setShowFitMeter((v) => !v)}
            aria-expanded={showFitMeter}
            className="flex items-center gap-1 text-[11px] font-medium text-primary outline-none"
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

          {/* Add to the site-wide compare selection — the floating tray then
              lets the user jump to /compare, exactly as from Explore. */}
          <button
            type="button"
            onClick={() => toggleCompare(property.id, property.listingType)}
            disabled={!comparing && !addable}
            aria-pressed={comparing}
            title={
              comparing
                ? 'Remove from comparison'
                : !addable
                  ? 'You can compare up to 3 homes at a time'
                  : compareType && compareType !== property.listingType
                    ? `Start a new comparison of ${property.listingType} homes`
                    : 'Add to comparison'
            }
            className={cn(
              'flex items-center gap-1 text-[11px] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              comparing
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Scale className="size-3" />
            {comparing ? 'Comparing' : 'Compare'}
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showFitMeter && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-20 overflow-hidden"
            >
              <div className="mt-2 space-y-3 rounded-lg bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium tracking-tight text-foreground">
                    How this home fits your brief
                  </p>
                  <span
                    className={cn(
                      'shrink-0 text-[11px] font-semibold',
                      tierTone(fit),
                    )}
                  >
                    {fitTier(fit)} overall
                  </span>
                </div>
                {fitBars.map((bar) => (
                  <FitBar key={bar.key} bar={bar} />
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
