import { useQuery } from '@tanstack/react-query'

import {
  fetchProperties,
  fetchPropertiesByIds,
  fetchPropertyById,
} from '@/features/properties/api'
import type { PropertyFilters } from '@/features/properties/types'

/** Centralized, typed query keys — the single place cache keys are defined. */
export const propertyKeys = {
  all: ['properties'] as const,
  list: (filters: PropertyFilters) =>
    [...propertyKeys.all, 'list', filters] as const,
  detail: (id: string) => [...propertyKeys.all, 'detail', id] as const,
  byIds: (ids: string[]) => [...propertyKeys.all, 'byIds', ids] as const,
}

export function useProperties(filters: PropertyFilters = {}) {
  return useQuery({
    queryKey: propertyKeys.list(filters),
    queryFn: () => fetchProperties(filters),
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
