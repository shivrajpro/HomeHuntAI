import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/**
 * Site-wide "saved shortlist" — property ids the user has bookmarked, with no
 * cap (unlike the 3-home compare selection), persisted to localStorage. No
 * backend: purely a client-side favourites list. Comparing shortlisted homes
 * reuses the existing per-card Compare toggle rather than a second mechanism.
 */

const STORAGE_KEY = 'homehuntai:shortlist'

interface ShortlistContextValue {
  ids: string[]
  toggle: (id: string) => void
  remove: (id: string) => void
  isSaved: (id: string) => boolean
  count: number
}

const ShortlistContext = createContext<ShortlistContextValue | null>(null)

function readStored(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string')
      : []
  } catch {
    return []
  }
}

export function ShortlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>(readStored)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }, [ids])

  const value = useMemo<ShortlistContextValue>(
    () => ({
      ids,
      toggle: (id) =>
        setIds((prev) =>
          prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
        ),
      remove: (id) => setIds((prev) => prev.filter((v) => v !== id)),
      isSaved: (id) => ids.includes(id),
      count: ids.length,
    }),
    [ids],
  )

  return (
    <ShortlistContext.Provider value={value}>
      {children}
    </ShortlistContext.Provider>
  )
}

export function useShortlist(): ShortlistContextValue {
  const ctx = useContext(ShortlistContext)
  if (!ctx) throw new Error('useShortlist must be used within a ShortlistProvider')
  return ctx
}
