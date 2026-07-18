import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { ListingType } from '@/features/properties/types'

/**
 * Site-wide "compare selection" — which property ids the user has picked to
 * compare (2–3 at a time), persisted to localStorage so the floating tray
 * survives a refresh. No backend: this is purely a client-side selection.
 *
 * A comparison is always within a single listing type — you can compare Buy
 * homes against each other, or Rent homes against each other, but never a mix
 * (a ₹2 Cr purchase against a ₹40k/mo rental is not a meaningful comparison).
 * Picking a home of a different type than the current selection therefore
 * starts a fresh comparison of that type rather than mixing the two.
 */

const STORAGE_KEY = 'homehuntai:compare'
export const MAX_COMPARE = 3

interface CompareEntry {
  id: string
  listingType: ListingType
}

interface CompareContextValue {
  selectedIds: string[]
  /** Listing type of the current selection, or null when nothing is selected. */
  compareType: ListingType | null
  toggle: (id: string, listingType: ListingType) => void
  remove: (id: string) => void
  clear: () => void
  isSelected: (id: string) => boolean
  /** Whether a home of this listing type can be added to the current selection. */
  canAdd: (listingType: ListingType) => boolean
}

const CompareContext = createContext<CompareContextValue | null>(null)

function isEntry(value: unknown): value is CompareEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CompareEntry).id === 'string' &&
    ((value as CompareEntry).listingType === 'Buy' ||
      (value as CompareEntry).listingType === 'Rent')
  )
}

function readStored(): CompareEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    // Legacy entries were bare id strings without a listing type; drop them so
    // the invariant (single-type selection) holds from the first render.
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, MAX_COMPARE) : []
  } catch {
    return []
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<CompareEntry[]>(readStored)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selected))
  }, [selected])

  const value = useMemo<CompareContextValue>(() => {
    const selectedIds = selected.map((e) => e.id)
    const compareType = selected[0]?.listingType ?? null
    return {
      selectedIds,
      compareType,
      toggle: (id, listingType) =>
        setSelected((prev) => {
          if (prev.some((e) => e.id === id)) return prev.filter((e) => e.id !== id)
          const currentType = prev[0]?.listingType ?? null
          // A different type can't join the current comparison — start over with
          // just this home so Buy and Rent are never compared together.
          if (currentType && currentType !== listingType) return [{ id, listingType }]
          if (prev.length >= MAX_COMPARE) return prev
          return [...prev, { id, listingType }]
        }),
      remove: (id) => setSelected((prev) => prev.filter((e) => e.id !== id)),
      clear: () => setSelected([]),
      isSelected: (id) => selectedIds.includes(id),
      // A same-type home needs a free slot; a different-type home always fits
      // because it replaces the current selection.
      canAdd: (listingType) =>
        compareType !== listingType || selectedIds.length < MAX_COMPARE,
    }
  }, [selected])

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  )
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within a CompareProvider')
  return ctx
}
