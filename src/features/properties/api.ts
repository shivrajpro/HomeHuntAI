import { supabase } from '@/lib/supabase'
import { propertySchema, type Property, type PropertyFilters } from '@/features/properties/types'

/** Shape of a row from the `properties` table (see supabase/migrations/0001_create_properties.sql). */
interface PropertyRow {
  id: string
  title: string
  region: string
  city: string
  state: string
  locality: string
  sub_locality: string
  address: string
  latitude: number
  longitude: number
  property_type: string
  listing_type: string
  bhk: number
  bathrooms: number
  balconies: number
  super_builtup_area_sqft: number
  carpet_area_sqft: number
  floor: number
  total_floors: number
  furnishing: string
  parking: string
  age_of_property_years: number
  facing: string
  price: number
  monthly_rent: number | null
  maintenance_per_month: number
  deposit: number | null
  available_from: string
  listed_on: string
  builder_name: string
  project_name: string
  rera_approved: boolean
  ownership: string
  description: string
  highlights: string[]
  amenities: string[]
  images: string[]
  contact: unknown
  nearby: unknown
  ai_insights: unknown
  tags: string[]
}

/** snake_case DB row -> camelCase domain type, validated so bad data fails loudly. */
function fromRow(row: PropertyRow): Property {
  return propertySchema.parse({
    id: row.id,
    title: row.title,
    region: row.region,
    city: row.city,
    state: row.state,
    locality: row.locality,
    subLocality: row.sub_locality,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    propertyType: row.property_type,
    listingType: row.listing_type,
    bhk: row.bhk,
    bathrooms: row.bathrooms,
    balconies: row.balconies,
    superBuiltupAreaSqft: row.super_builtup_area_sqft,
    carpetAreaSqft: row.carpet_area_sqft,
    floor: row.floor,
    totalFloors: row.total_floors,
    furnishing: row.furnishing,
    parking: row.parking,
    ageOfPropertyYears: row.age_of_property_years,
    facing: row.facing,
    price: row.price,
    monthlyRent: row.monthly_rent,
    maintenancePerMonth: row.maintenance_per_month,
    deposit: row.deposit,
    availableFrom: row.available_from,
    listedOn: row.listed_on,
    builderName: row.builder_name,
    projectName: row.project_name,
    reraApproved: row.rera_approved,
    ownership: row.ownership,
    description: row.description,
    highlights: row.highlights,
    amenities: row.amenities,
    images: row.images,
    contact: row.contact,
    nearby: row.nearby,
    aiInsights: row.ai_insights,
    tags: row.tags,
  })
}

/** Quote a value for PostgREST's `.or()` filter syntax so commas/parens in free text don't break it. */
function escapeOrValue(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`
}

/** Fetch listings, optionally filtered — filters run server-side as Supabase query predicates. */
export async function fetchProperties(
  filters: PropertyFilters = {},
): Promise<Property[]> {
  const { search, region, listingType, propertyType, minBhk, maxPrice } = filters

  let query = supabase.from('properties').select('*')

  if (region) query = query.eq('region', region)
  if (listingType) query = query.eq('listing_type', listingType)
  if (propertyType) query = query.eq('property_type', propertyType)
  if (minBhk != null) query = query.gte('bhk', minBhk)
  if (maxPrice != null) query = query.lte('price', maxPrice)

  if (search?.trim()) {
    const pattern = escapeOrValue(`%${search.trim()}%`)
    query = query.or(
      [
        `title.ilike.${pattern}`,
        `locality.ilike.${pattern}`,
        `sub_locality.ilike.${pattern}`,
        `city.ilike.${pattern}`,
        `project_name.ilike.${pattern}`,
      ].join(','),
    )
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(fromRow)
}

/** Fetch a single listing by id, or `null` if it doesn't exist. */
export async function fetchPropertyById(
  id: string,
): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

/** Fetch several listings by id (used for the compare tray + compare page). */
export async function fetchPropertiesByIds(ids: string[]): Promise<Property[]> {
  const uniqueIds = Array.from(new Set(ids))
  if (uniqueIds.length === 0) return []

  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .in('id', uniqueIds)
  if (error) throw error

  const byId = new Map((data ?? []).map((row) => [row.id, fromRow(row)]))
  // Preserve the caller's order rather than the DB's.
  return uniqueIds
    .map((id) => byId.get(id))
    .filter((p): p is Property => p != null)
}
