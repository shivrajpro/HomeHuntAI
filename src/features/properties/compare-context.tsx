import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Site-wide "compare selection" — which property ids the user has picked to
 * compare (2–3 at a time), persisted to localStorage so the floating tray
 * survives a refresh. No backend: this is purely a client-side selection.
 */

const STORAGE_KEY = 'homehuntai:compare'
export const MAX_COMPARE = 3

interface CompareContextValue {
  selectedIds: string[]
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  isSelected: (id: string) => boolean
  canAddMore: boolean
}

const CompareContext = createContext<CompareContextValue | null>(null)

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string').slice(0, MAX_COMPARE)
      : []
  } catch {
    return []
  }
}

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>(readStored)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedIds))
  }, [selectedIds])

  const value = useMemo<CompareContextValue>(
    () => ({
      selectedIds,
      toggle: (id) =>
        setSelectedIds((prev) =>
          prev.includes(id)
            ? prev.filter((v) => v !== id)
            : prev.length < MAX_COMPARE
              ? [...prev, id]
              : prev,
        ),
      remove: (id) => setSelectedIds((prev) => prev.filter((v) => v !== id)),
      clear: () => setSelectedIds([]),
      isSelected: (id) => selectedIds.includes(id),
      canAddMore: selectedIds.length < MAX_COMPARE,
    }),
    [selectedIds],
  )

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  )
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used within a CompareProvider')
  return ctx
}
