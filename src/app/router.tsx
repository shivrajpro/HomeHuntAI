import { lazy } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '@/app/root-layout'
import { NotFoundPage } from '@/app/not-found-page'

// Route-level code splitting. In particular, Nestor pulls in
// `reasoning.ts`, which still imports the local 2,000-listing seed
// (`data/listings.json`, ~5.7MB uncompressed — the one bundle-size warning
// `npm run build` reports, see project-stage.md's Phase 6). Statically
// importing every route component here would put that whole payload on the
// module graph for *every* page — home, explore, everything — not just
// `/nestor`. Lazy-loading means it's only ever fetched when a user actually
// opens Nestor.
const HomePage = lazy(() =>
  import('@/features/home/home-page').then((m) => ({ default: m.HomePage })),
)
const ExplorePage = lazy(() =>
  import('@/features/properties/explore-page').then((m) => ({ default: m.ExplorePage })),
)
const PropertyDetailPage = lazy(() =>
  import('@/features/properties/property-detail-page').then((m) => ({
    default: m.PropertyDetailPage,
  })),
)
const ComparePage = lazy(() =>
  import('@/features/properties/compare-page').then((m) => ({ default: m.ComparePage })),
)
const ShortlistPage = lazy(() =>
  import('@/features/properties/shortlist-page').then((m) => ({ default: m.ShortlistPage })),
)
const NestorPage = lazy(() =>
  import('@/features/nestor/nestor-page').then((m) => ({ default: m.NestorPage })),
)
const DecisionReportPage = lazy(() =>
  import('@/features/nestor/decision-report-page').then((m) => ({
    default: m.DecisionReportPage,
  })),
)

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/property/:id', element: <PropertyDetailPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/shortlist', element: <ShortlistPage /> },
      { path: '/nestor', element: <NestorPage /> },
      { path: '/decision-report', element: <DecisionReportPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
