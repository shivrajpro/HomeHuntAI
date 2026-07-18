import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  fetchProperties,
  fetchPropertiesByIds,
  fetchPropertyById,
  fetchRankingFields,
  type RankingPoolBounds,
} from '@/features/properties/api'
import type { PropertyFilters, PropertyRankingFields } from '@/features/properties/types'
import { queryClient } from '@/lib/query-client'

/** Centralized, typed query keys — the single place cache keys are defined. */
export const propertyKeys = {
  all: ['properties'] as const,
  list: (filters: PropertyFilters, limit?: number) =>
    [...propertyKeys.all, 'list', filters, limit ?? null] as const,
  detail: (id: string) => [...propertyKeys.all, 'detail', id] as const,
  byIds: (ids: string[]) => [...propertyKeys.all, 'byIds', ids] as const,
  ranking: (bounds: RankingPoolBounds) =>
    [...propertyKeys.all, 'ranking', bounds] as const,
}

/**
 * Nestor's ranking pool, read through the same cache the hooks use. Nestor
 * runs from an event handler rather than a render, so it fetches imperatively
 * instead of via `useQuery` — but editing a priority chip re-ranks the *same*
 * intent against the *same* pool, and follow-up turns usually keep the bounds
 * they inherited, so going through the cache makes those free rather than
 * re-reading the catalogue every time. Listings are static seed data, hence
 * the long stale time.
 */
export function fetchRankingPool(
  bounds: RankingPoolBounds,
): Promise<PropertyRankingFields[]> {
  return queryClient.fetchQuery({
    queryKey: propertyKeys.ranking(bounds),
    queryFn: () => fetchRankingFields(bounds),
    staleTime: 5 * 60_000,
  })
}

export function useProperties(filters: PropertyFilters = {}, limit?: number) {
  return useQuery({
    queryKey: propertyKeys.list(filters, limit),
    queryFn: () => fetchProperties(filters, limit),
    // Keep the previous page on screen while a larger `limit` loads so
    // "Load more" appends rather than tearing the whole grid down to skeletons.
    placeholderData: keepPreviousData,
  })
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchPropertyById(id),
    enabled: Boolean(id),
  })
}

/** Fetch multiple listings by id — powers the compare tray and compare page. */
export function usePropertiesByIds(ids: string[]) {
  return useQuery({
    queryKey: propertyKeys.byIds(ids),
    queryFn: () => fetchPropertiesByIds(ids),
    enabled: ids.length > 0,
  })
}
