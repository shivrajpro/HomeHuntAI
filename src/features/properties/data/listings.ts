import { z } from 'zod'

import { propertySchema, type Property } from '@/features/properties/types'
import rawListings from '@/features/properties/data/listings.json'

/**
 * Seed listings — 1,500 fictional properties, 500 each across Bangalore,
 * Hyderabad and the Delhi NCR, generated to mirror the way Indian portals
 * present the market (real localities, realistic ₹ pricing, RERA status,
 * amenities and locality-level AI scores). See `scripts`/README for regen.
 *
 * Localities and nearby landmarks are real places; every builder, project,
 * address, contact and listing is invented.
 */
const listingsArraySchema = z.array(propertySchema)

/**
 * Validate the seed against the schema once at module load. A malformed seed
 * fails loudly here instead of surfacing later as a mystery UI bug.
 */
export const LISTINGS: Property[] = listingsArraySchema.parse(rawListings)
