-- HomeHuntAI: copilot_requests table
-- Sliding-window log the `copilot-intent` edge function uses to rate-limit
-- Gemini calls per caller (see RATE_LIMIT_MAX_REQUESTS in
-- supabase/functions/copilot-intent/index.ts). No app code reads this table
-- directly other than the edge function's service-role client.

create table if not exists public.copilot_requests (
  id bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

-- The edge function counts+inserts by client_key within a recent window.
create index if not exists copilot_requests_client_key_created_at_idx
  on public.copilot_requests (client_key, created_at desc);

-- No public access at all — only the edge function's service-role key
-- touches this table, which bypasses RLS anyway. Enabling RLS with no
-- policies is defense in depth against the anon/PostgREST API ever exposing
-- it.
alter table public.copilot_requests enable row level security;
