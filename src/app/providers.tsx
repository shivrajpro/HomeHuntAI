import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

import { queryClient } from '@/lib/query-client'
import { CompareProvider } from '@/features/properties/compare-context'
import { ShortlistProvider } from '@/features/properties/shortlist-context'

/**
 * Global app providers: theme (dark mode), data layer, compare selection,
 * and the saved shortlist.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <CompareProvider>
          <ShortlistProvider>{children}</ShortlistProvider>
        </CompareProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
