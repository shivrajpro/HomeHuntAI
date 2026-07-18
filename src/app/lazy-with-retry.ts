import { lazy, type ComponentType } from 'react'

/**
 * Wraps a dynamic `import()` so that a failed chunk fetch triggers a single
 * full-page reload instead of surfacing a hard error.
 *
 * Route chunks are versioned URLs (Vite stamps a `?t=` in dev and a content
 * hash in prod). When the server regenerates them — an HMR rebuild in dev, a
 * redeploy in prod — a tab that loaded earlier still points at the old URL, so
 * the fetch 404s with "Failed to fetch dynamically imported module". A reload
 * pulls the fresh manifest and resolves it.
 *
 * A `sessionStorage` flag keyed to each chunk guards against a reload loop: if
 * the import still fails right after a reload (a genuine error, not a stale
 * chunk), the failure is rethrown so the route error boundary can render.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  key: string,
): ReturnType<typeof lazy<T>> {
  const storageKey = `chunk-retry:${key}`

  return lazy(async () => {
    try {
      const mod = await factory()
      // Success — clear the guard so a future stale chunk can reload again.
      window.sessionStorage.removeItem(storageKey)
      return mod
    } catch (error) {
      const alreadyRetried = window.sessionStorage.getItem(storageKey) === '1'
      if (!alreadyRetried) {
        window.sessionStorage.setItem(storageKey, '1')
        window.location.reload()
        // Return a never-resolving promise so nothing renders before the
        // reload takes over.
        return new Promise<{ default: T }>(() => {})
      }
      // Reload already happened and it still failed: this is a real error.
      window.sessionStorage.removeItem(storageKey)
      throw error
    }
  })
}
