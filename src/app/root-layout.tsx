import { Suspense } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { Compass, Heart, Home, Sparkles } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import { CompareTray } from '@/features/properties/components/compare-tray'
import { useCompare } from '@/features/properties/compare-context'
import { useShortlist } from '@/features/properties/shortlist-context'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/explore', label: 'Explore', end: false, icon: Compass },
  { to: '/nestor', label: 'Ask Nestor', end: false, icon: Sparkles },
  { to: '/shortlist', label: 'Shortlist', end: false, icon: Heart },
] as const

/** A small badge on the Shortlist nav item once at least one home is saved. */
function ShortlistBadge({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="grid size-3.5 place-items-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
      {count > 9 ? '9+' : count}
    </span>
  )
}

/**
 * Fixed bottom tab bar shown only on small screens, replacing the header nav
 * (which stays `hidden` below `sm`). Mirrors the same routes as the desktop
 * nav so the app is fully navigable without the hidden-nav dead end.
 */
function MobileNav() {
  const { count } = useShortlist()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-xl sm:hidden">
      <div className="grid grid-cols-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )
            }
          >
            <span className="relative">
              <item.icon className="size-5" />
              {item.to === '/shortlist' && (
                <span className="absolute -right-1.5 -top-1.5">
                  <ShortlistBadge count={count} />
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Suspense fallback while a lazily-loaded route chunk is still being fetched. */
function RouteLoading() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-[50vh] place-items-center">
      <div className="size-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
    </div>
  )
}

export function RootLayout() {
  const { count } = useShortlist()
  const { selectedIds } = useCompare()
  const { pathname } = useLocation()

  // The compare tray is `fixed`; reserve matching bottom space wherever it
  // actually shows so page content scrolls clear instead of hiding under it.
  // (It's suppressed on `/compare`, so no extra space is needed there.)
  const trayVisible = selectedIds.length > 0 && pathname !== '/compare'

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Home className="size-4" />
            </span>
            <span className="tracking-tight">
              HomeHunt
              <span className="text-primary"> AI</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {item.label}
                {item.to === '/shortlist' && <ShortlistBadge count={count} />}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <span className="hidden items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-muted-foreground sm:flex">
              <Sparkles className="size-3 text-primary" />
              MVP
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        className={cn(
          'mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-6',
          trayVisible ? 'pb-40 sm:pb-24' : 'pb-24 sm:pb-8',
        )}
      >
        <Suspense fallback={<RouteLoading />}>
          <Outlet />
        </Suspense>
      </main>

      <MobileNav />
      <CompareTray />
      <ScrollRestoration />
    </div>
  )
}
