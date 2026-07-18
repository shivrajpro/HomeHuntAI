import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '@/app/root-layout'
import { NotFoundPage } from '@/app/not-found-page'
import { RouteErrorBoundary } from '@/app/route-error-boundary'
import { lazyWithRetry } from '@/app/lazy-with-retry'

// Route-level code splitting: each page's JS is only fetched when a user
// actually navigates to it, rather than every route riding on the initial
// load. `lazyWithRetry` reloads once on a stale-chunk fetch failure so a
// server rebuild/redeploy doesn't strand tabs that loaded the old manifest.
const HomePage = lazyWithRetry(
  () => import('@/features/home/home-page').then((m) => ({ default: m.HomePage })),
  'home',
)
const ExplorePage = lazyWithRetry(
  () => import('@/features/properties/explore-page').then((m) => ({ default: m.ExplorePage })),
  'explore',
)
const PropertyDetailPage = lazyWithRetry(
  () =>
    import('@/features/properties/property-detail-page').then((m) => ({
      default: m.PropertyDetailPage,
    })),
  'property-detail',
)
const ComparePage = lazyWithRetry(
  () => import('@/features/properties/compare-page').then((m) => ({ default: m.ComparePage })),
  'compare',
)
const ShortlistPage = lazyWithRetry(
  () => import('@/features/properties/shortlist-page').then((m) => ({ default: m.ShortlistPage })),
  'shortlist',
)
const NestorPage = lazyWithRetry(
  () => import('@/features/nestor/nestor-page').then((m) => ({ default: m.NestorPage })),
  'nestor',
)
const DecisionReportPage = lazyWithRetry(
  () =>
    import('@/features/nestor/decision-report-page').then((m) => ({
      default: m.DecisionReportPage,
    })),
  'decision-report',
)

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: '/', element: <HomePage />, errorElement: <RouteErrorBoundary /> },
      { path: '/explore', element: <ExplorePage />, errorElement: <RouteErrorBoundary /> },
      {
        path: '/property/:id',
        element: <PropertyDetailPage />,
        errorElement: <RouteErrorBoundary />,
      },
      { path: '/compare', element: <ComparePage />, errorElement: <RouteErrorBoundary /> },
      { path: '/shortlist', element: <ShortlistPage />, errorElement: <RouteErrorBoundary /> },
      { path: '/nestor', element: <NestorPage />, errorElement: <RouteErrorBoundary /> },
      {
        path: '/decision-report',
        element: <DecisionReportPage />,
        errorElement: <RouteErrorBoundary />,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
