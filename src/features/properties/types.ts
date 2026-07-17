import { z } from 'zod'

/**
 * Property domain — the single source of truth for HomeHuntAI.
 * The Zod schema validates our seed data at load time; the TypeScript
 * types are inferred from it so the two never drift apart.
 *
 * The data models the Indian property market (Bangalore, Hyderabad, Delhi NCR)
 * the way portals like MagicBricks or 99acres present it: prices in ₹, BHK
 * configurations, super built-up / carpet areas, RERA status and locality-level
 * AI scores. All listings are fictional.
 */

export const listingTypeSchema = z.enum(['Buy', 'Rent'])
export type ListingType = z.infer<typeof listingTypeSchema>

export const propertyTypeSchema = z.enum([
  'Apartment',
  'Villa',
  'Independent House',
  'Plot',
  'Builder Floor',
])
export type PropertyType = z.infer<typeof propertyTypeSchema>

/** The markets we seed; `region` groups NCR sub-cities together. */
export const regionSchema = z.enum([
  'Bangalore',
  'Hyderabad',
  'Delhi NCR',
  'Pune',
])
export type Region = z.infer<typeof regionSchema>

export const furnishingSchema = z.enum([
  'Unfurnished',
  'Semi Furnished',
  'Fully Furnished',
])
export type Furnishing = z.infer<typeof furnishingSchema>

export const ownershipSchema = z.enum(['Freehold', 'Leasehold'])
export type Ownership = z.infer<typeof ownershipSchema>

/** A real nearby landmark; `travelTimeMinutes` is present for transit points. */
const nearbySchema = z.object({
  type: z.string(),
  name: z.string(),
  distanceKm: z.number().nonnegative(),
  travelTimeMinutes: z.number().int().nonnegative().optional(),
})

const contactSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
})

/**
 * Locality-level AI scores (0–100) Nestor reasons over instead of raw
 * specs — "walkable, family-friendly, strong investment" rather than a table.
 */
const aiInsightsSchema = z.object({
  walkability: z.number().int().min(0).max(100),
  familyScore: z.number().int().min(0).max(100),
  investmentScore: z.number().int().min(0).max(100),
  commuteScore: z.number().int().min(0).max(100),
  safetyScore: z.number().int().min(0).max(100),
  nightlifeScore: z.number().int().min(0).max(100),
  greenScore: z.number().int().min(0).max(100),
})

export const propertySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  region: regionSchema,
  city: z.string(),
  state: z.string(),
  locality: z.string(),
  subLocality: z.string(),
  address: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  propertyType: propertyTypeSchema,
  listingType: listingTypeSchema,
  /** 0 for plots. */
  bhk: z.number().int().min(0),
  bathrooms: z.number().int().min(0),
  balconies: z.number().int().min(0),
  superBuiltupAreaSqft: z.number().int().positive(),
  carpetAreaSqft: z.number().int().positive(),
  floor: z.number().int().min(0),
  totalFloors: z.number().int().min(0),
  furnishing: furnishingSchema,
  parking: z.string(),
  ageOfPropertyYears: z.number().int().min(0),
  facing: z.string(),
  /** Sale price (Buy) or monthly rent (Rent), in ₹ — always populated so it sorts. */
  price: z.number().int().positive(),
  monthlyRent: z.number().int().positive().nullable(),
  maintenancePerMonth: z.number().int().min(0),
  deposit: z.number().int().min(0).nullable(),
  availableFrom: z.string(),
  listedOn: z.string(),
  builderName: z.string(),
  projectName: z.string(),
  reraApproved: z.boolean(),
  ownership: ownershipSchema,
  description: z.string(),
  highlights: z.array(z.string()),
  amenities: z.array(z.string()),
  images: z.array(z.string().url()).min(1),
  contact: contactSchema,
  nearby: z.array(nearbySchema),
  aiInsights: aiInsightsSchema,
  tags: z.array(z.string()),
})

export type Property = z.infer<typeof propertySchema>
export type PropertyContact = z.infer<typeof contactSchema>
export type PropertyNearby = z.infer<typeof nearbySchema>
export type PropertyInsights = z.infer<typeof aiInsightsSchema>

/**
 * The only fields Nestor needs to filter, rank and explain a listing. Nestor
 * has to scan the whole catalogue to rank it, and the fields it never reads —
 * `description`, `nearby`, `images`, `amenities` — are ~60% of a listing's
 * bytes, so it scans this projection instead and hydrates the handful of homes
 * it actually shows. Picked from `propertySchema` so the two can't drift, and
 * so a full `Property` is always a valid `PropertyRankingFields`.
 */
export const rankingFieldsSchema = propertySchema.pick({
  id: true,
  region: true,
  propertyType: true,
  listingType: true,
  bhk: true,
  price: true,
  superBuiltupAreaSqft: true,
  aiInsights: true,
})

export type PropertyRankingFields = z.infer<typeof rankingFieldsSchema>

export interface PropertyFilters {
  /** Free-text match across title, locality, city, project, and tags. */
  search?: string
  region?: Region
  listingType?: ListingType
  propertyType?: PropertyType
  minBhk?: number
  maxPrice?: number
}

/** Price per square foot of super built-up area, rounded — derived, never stored. */
export function pricePerSqft(
  property: Pick<Property, 'price' | 'superBuiltupAreaSqft'>,
): number {
  return Math.round(property.price / property.superBuiltupAreaSqft)
}
