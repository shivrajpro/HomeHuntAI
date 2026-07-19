/**
 * The shared visual grammar for fit scores — greener the better — used by the
 * pick cards, the fit-meter breakdown and the trade-off simulator rows so a
 * given fit % reads identically everywhere.
 */

/** Tailwind class for a fit badge — greener the better. */
export function fitTone(fit: number): string {
  if (fit >= 80) return 'bg-success/15 text-success'
  if (fit >= 65) return 'bg-primary/15 text-primary'
  return 'bg-warning/15 text-warning'
}

/** Text colour for a fit tier — greener the stronger. */
export function tierTone(score: number): string {
  if (score >= 85) return 'text-success'
  if (score >= 70) return 'text-primary'
  if (score >= 55) return 'text-foreground'
  if (score >= 40) return 'text-warning'
  return 'text-muted-foreground'
}
