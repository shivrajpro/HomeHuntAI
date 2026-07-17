-- HomeHuntAI: properties table
-- Mirrors src/features/properties/types.ts (propertySchema). Scalar fields
-- used in filtering/sorting get real columns + indexes; nested/array fields
-- (contact, nearby, aiInsights, amenities, highlights, images, tags) are
-- stored as jsonb/text[] since the app reads them as whole objects.

create table if not exists public.properties (
  id uuid primary key,
  title text not null,
  region text not null,
  city text not null,
  state text not null,
  locality text not null,
  sub_locality text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  property_type text not null,
  listing_type text not null,
  bhk integer not null,
  bathrooms integer not null,
  balconies integer not null,
  super_builtup_area_sqft integer not null,
  carpet_area_sqft integer not null,
  floor integer not null,
  total_floors integer not null,
  furnishing text not null,
  parking text not null,
  age_of_property_years integer not null,
  facing text not null,
  price bigint not null,
  monthly_rent bigint,
  maintenance_per_month integer not null,
  deposit bigint,
  available_from date not null,
  listed_on date not null,
  builder_name text not null,
  project_name text not null,
  rera_approved boolean not null,
  ownership text not null,
  description text not null,
  highlights text[] not null default '{}',
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  contact jsonb not null,
  nearby jsonb not null default '[]',
  ai_insights jsonb not null,
  tags text[] not null default '{}'
);

-- Indexes for the filters Explore/Nestor actually query on
-- (see PropertyFilters in types.ts and matchesFilters in api.ts).
create index if not exists properties_region_idx on public.properties (region);
create index if not exists properties_listing_type_idx on public.properties (listing_type);
create index if not exists properties_property_type_idx on public.properties (property_type);
create index if not exists properties_bhk_idx on public.properties (bhk);
create index if not exists properties_price_idx on public.properties (price);
create index if not exists properties_tags_idx on public.properties using gin (tags);

-- No auth in the app yet — listings are public read-only data.
alter table public.properties enable row level security;

create policy "Public read access" on public.properties
  for select
  using (true);

-- Writes only via the service role key (used by the one-off migration
-- script), never from the browser/anon key.
