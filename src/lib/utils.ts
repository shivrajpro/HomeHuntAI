import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a number as a localized currency string (no fractional digits). */
export function formatPrice(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Format ₹ amounts the way Indian portals do: crores and lakhs above a lakh,
 * grouped thousands below. `85,00,000 → ₹85 L`, `1,25,00,000 → ₹1.25 Cr`.
 */
export function formatINR(value: number): string {
  if (value >= 1_00_00_000) {
    const cr = value / 1_00_00_000
    return `₹${trimZeros(cr.toFixed(2))} Cr`
  }
  if (value >= 1_00_000) {
    const lakh = value / 1_00_000
    return `₹${trimZeros(lakh.toFixed(2))} L`
  }
  return `₹${new Intl.NumberFormat('en-IN').format(value)}`
}

function trimZeros(fixed: string): string {
  return fixed.replace(/\.?0+$/, '')
}

/** Join clauses as "a, b and c" for readable prose. */
export function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
