import { createBrowserRouter } from 'react-router-dom'

import { RootLayout } from '@/app/root-layout'
import { HomePage } from '@/features/home/home-page'
import { ComparePage } from '@/features/properties/compare-page'
import { ExplorePage } from '@/features/properties/explore-page'
import { PropertyDetailPage } from '@/features/properties/property-detail-page'
import { ShortlistPage } from '@/features/properties/shortlist-page'
import { CopilotPage } from '@/features/copilot/copilot-page'
import { DecisionReportPage } from '@/features/copilot/decision-report-page'
import { NotFoundPage } from '@/app/not-found-page'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/explore', element: <ExplorePage /> },
      { path: '/property/:id', element: <PropertyDetailPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/shortlist', element: <ShortlistPage /> },
      { path: '/copilot', element: <CopilotPage /> },
      { path: '/decision-report', element: <DecisionReportPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
