// One-off migration: load src/features/properties/data/listings.json into
// the Supabase `properties` table (see supabase/migrations/0001_create_properties.sql).
//
// Usage:
//   1. Run the SQL in supabase/migrations/0001_create_properties.sql via the
//      Supabase dashboard's SQL Editor first (creates the table).
//   2. Fill in .env (see .env.example) with your project's URL + service
//      role key (Settings -> API -> service_role secret).
//   3. node --env-file=.env scripts/migrate-to-supabase.mjs
//
// Uses the service role key (bypasses RLS) because this is a trusted,
// local, one-off admin operation — never ship this key to the browser.

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example to .env, fill it in, then run:\n' +
      '  node --env-file=.env scripts/migrate-to-supabase.mjs',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const listingsPath = new URL(
  '../src/features/properties/data/listings.json',
  import.meta.url,
)
const listings = JSON.parse(await readFile(listingsPath, 'utf-8'))

function toRow(property) {
  return {
    id: property.id,
    title: property.title,
    region: property.region,
    city: property.city,
    state: property.state,
    locality: property.locality,
    sub_locality: property.subLocality,
    address: property.address,
    latitude: property.latitude,
    longitude: property.longitude,
    property_type: property.propertyType,
    listing_type: property.listingType,
    bhk: property.bhk,
    bathrooms: property.bathrooms,
    balconies: property.balconies,
    super_builtup_area_sqft: property.superBuiltupAreaSqft,
    carpet_area_sqft: property.carpetAreaSqft,
    floor: property.floor,
    total_floors: property.totalFloors,
    furnishing: property.furnishing,
    parking: property.parking,
    age_of_property_years: property.ageOfPropertyYears,
    facing: property.facing,
    price: property.price,
    monthly_rent: property.monthlyRent,
    maintenance_per_month: property.maintenancePerMonth,
    deposit: property.deposit,
    available_from: property.availableFrom,
    listed_on: property.listedOn,
    builder_name: property.builderName,
    project_name: property.projectName,
    rera_approved: property.reraApproved,
    ownership: property.ownership,
    description: property.description,
    highlights: property.highlights,
    amenities: property.amenities,
    images: property.images,
    contact: property.contact,
    nearby: property.nearby,
    ai_insights: property.aiInsights,
    tags: property.tags,
  }
}

const rows = listings.map(toRow)
const BATCH_SIZE = 500

console.log(`Migrating ${rows.length} listings in batches of ${BATCH_SIZE}...`)

for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  const { error } = await supabase.from('properties').upsert(batch)
  if (error) {
    console.error(`Batch ${i / BATCH_SIZE + 1} failed:`, error.message)
    process.exit(1)
  }
  console.log(`  batch ${i / BATCH_SIZE + 1}: ${batch.length} rows OK`)
}

console.log('Done.')
