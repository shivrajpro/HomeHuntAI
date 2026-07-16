import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          This page moved out
        </h1>
        <p className="mx-auto max-w-sm text-muted-foreground">
          We couldn&apos;t find what you were looking for.
        </p>
        <Button asChild>
          <Link to="/">Back to Explore</Link>
        </Button>
      </div>
    </div>
  )
}
