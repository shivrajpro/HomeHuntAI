import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Rendered by React Router whenever a route throws — a failed data load, a
 * render error, or a chunk that couldn't be fetched even after a retry reload
 * (see {@link lazyWithRetry}). Replaces React Router's default dev error page
 * with a branded, recoverable screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError()

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">Something broke</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          This page couldn&apos;t load
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          A part of the app failed to load. Reloading usually fixes it.
        </p>
        <p className="mx-auto max-w-sm break-words text-xs text-muted-foreground/70">
          {message}
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={() => window.location.reload()}>
            <RotateCcw />
            Reload
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
