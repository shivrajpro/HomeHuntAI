# HomeHuntAI — Project Stage

> Living status doc. Updated after each coding session, once the production
> build (`npm run build`) passes. Newest status at the top of "Current stage".

---

## The idea

**HomeHuntAI** is an AI-powered home-decision partner for the Indian property
market. Instead of forcing buyers/renters to wrestle with raw filters and
spreadsheets, it reads listings, neighborhoods, and the user's stated priorities
and helps them *decide with confidence*.

- **Markets:** Bangalore, Hyderabad, Delhi NCR, Pune.
- **Data:** 2,000 fictional but realistic listings (`src/features/properties/data/listings.json`),
  validated at load time by a Zod schema (`src/features/properties/types.ts`).
  Localities and landmarks are real; every builder, project, price, and contact
  is invented. Each locality carries AI scores (walkability, family, investment,
  commute, safety, nightlife, green cover).
- **Differentiator:** **Nestor** — a conversational layer that ranks homes
  by *fit* and explains trade-offs, reasoning over the AI scores rather than
  dumping specs.

### Stack

Vite 8 · React 19 · TypeScript · Tailwind v4 · React Router 7 ·
TanStack Query · Zod · react-hook-form · framer-motion · next-themes ·
Supabase (Postgres data layer, wired in Phase 2; Edge Functions + Gemini for
Nestor intent parsing, wired in Phase 3 — both part of the stack migration
below).

### Planned stack migration (decided 2026-07-16, in progress)

The project will move off the local-only mock stack to:

- **Frontend:** React + Vite + TypeScript (unchanged)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Backend logic:** Supabase Edge Functions
- **AI:** Gemini 2.5 Flash (replaces the local deterministic reasoning engine)
- **Hosting:** Vercel (frontend) + Supabase (backend)

This supersedes the earlier "no backend / no real APIs / deterministic only"
constraint recorded for the hackathon MVP phase.

Driven by the **OpenAI × NamasteDev Codex Hackathon** — submission deadline
**2026-07-19, 11:59 PM IST** (hosted prototype URL + public repo + 3-min
demo video required; judged on innovation, execution, impact, product
quality, meaningful use of AI, creativity).

**Migration phases (in order):**

1. Supabase project setup — Postgres schema + migrate the 2,000 listings in
   (also fixes the ~5.7MB bundled-JSON size warning from Phase 6 below).
2. Supabase client wiring — swap mock `api.ts` for real Supabase queries
   behind the same `useProperties`/`useProperty` hook interfaces.
3. Gemini 2.5 Flash via a Supabase Edge Function — replaces/fronts the local
   `reasoning.ts` Nestor engine. Highest-leverage for "meaningful use of AI".
4. Deploy: Vercel (frontend) + Supabase (backend) — get a live URL early.
5. Storage (property images) — lowest priority, real uploaded imagery.

**Status: Phase 1 done** (2026-07-16) — Supabase project created, `properties`
table live (`supabase/migrations/0001_create_properties.sql`, public RLS read
policy), all 2,000 listings migrated via `npm run migrate:supabase`
(`scripts/migrate-to-supabase.mjs`) and verified via the REST API
(`content-range: 0-0/2000`). `@supabase/supabase-js` installed, `.env`
holds real keys (git-ignored), `.env.example` holds blank placeholders,
`src/lib/supabase.ts` has the client.

**Phase 2 done** (2026-07-16) — `src/features/properties/api.ts` now queries
Supabase directly instead of the local mock, behind the same
`useProperties`/`useProperty`/`usePropertiesByIds` hooks, so no other
component changed. A `fromRow` mapper converts snake_case DB rows to the
camelCase `Property` type and validates through `propertySchema.parse`.
Filters (region/listingType/propertyType/minBhk/maxPrice) now run
server-side as Supabase query predicates; free-text search uses `.or()` +
`ilike` across title/locality/subLocality/city/projectName (tags are no
longer searched — a minor narrowing versus the old mock, since PostgREST
doesn't cleanly support array-element substring matches). Verified live
against the real Supabase data with a headless-Chromium smoke test: Explore
lists 1,000 real homes, search narrows results server-side, a property
detail page renders full nested data, and the `.in()` query behind
`fetchPropertiesByIds` was confirmed directly. No console errors. The
5.7 MB bundle warning (Phase 6, below) is unchanged for now — `reasoning.ts`
(Phase 3) still imports the local `listings.json` seed. **Phase 3 — Gemini
2.5 Flash via a Supabase Edge Function — next.**

**Phase 3 done** (2026-07-16) — intent parsing (turning a free-text Nestor
brief, plus the previous turn's intent on a follow-up, into a structured
`NestorIntent`) now goes through Gemini via a new Supabase Edge Function,
`supabase/functions/nestor-intent` (Deno, uses the official `@google/genai`
SDK's `GoogleGenAI` client, `npm:@google/genai` specifier — no separate
install step, Deno resolves it at deploy time). Ranking and all explanation
text (fit scores, strengths/trade-off/confidence, near-misses, Decision
Report) stay the existing deterministic TypeScript in `reasoning.ts` — same
`NestorIntent`/`NestorAnswer` shapes, no UI changes needed beyond making
`runNestor` async. `deriveIntentAsync` calls the edge function first and
falls back to the original regex parser (`deriveIntent`, kept in place) on
any network/API failure, so a Gemini outage degrades gracefully instead of
breaking Nestor. Model picked by live-probing this project's actual
Gemini key/quota: `gemini-2.5-flash` and `gemini-2.5-flash-lite` are
hard-blocked for new API keys (404), the `gemini-2.0-flash` line has zero
free-tier quota on this key (429), and `gemini-3.5-flash`/`gemini-flash-latest`
were consistently 503 "high demand" at integration time — `gemini-flash-lite-latest`
(an alias Google keeps pointed at its current default lite-flash model)
responded reliably and is plenty capable for structured JSON intent
extraction. Verified end-to-end with a Playwright smoke test against the
real dev server (not just direct edge-function curls): a first-turn brief
with two life-stage phrases surfaced both lifestyle tags and ranked picks
correctly, a follow-up ("make it cheaper") correctly cut the budget by 20%
and re-ranked, "Updated your search." led the reply, and there were no
console errors. Also fixed Nestor's footer caption, which used to
claim "no data leaves your browser" — no longer true now that the brief is
sent to the edge function. **Architecture decision:** this is intentionally
Gemini-for-parsing-only for now (ranking/explanations stay deterministic);
a later full-replace (Gemini reasoning over the candidate listings
end-to-end) is planned but not started. **Phase 4 — deploy to Vercel +
Supabase — next.**

---

## Current stage

**Last verified build:** ✅ passing (`npm run build`) — 2026-07-17

### Done

- **Assistant renamed "Copilot" → "Nestor" (2026-07-17):** a full branding
  pass, not just a text swap. Header nav reads **"Ask Nestor"**; the route
  moved `/copilot` → `/nestor`; UI copy, document titles, the off-topic scope
  fallback and the marketing home page all speak as Nestor. Code followed the
  branding: `src/features/copilot/` → `src/features/nestor/`,
  `copilot-page.tsx` → `nestor-page.tsx`, `CopilotIntent`/`CopilotAnswer` →
  `NestorIntent`/`NestorAnswer`, `runCopilot` → `runNestor`,
  `tests/copilot.spec.ts` → `tests/nestor.spec.ts`. Earlier entries in this
  file were rewritten to the new names so they still match the code they
  describe — the rename is recorded here rather than left implicit.
  **The two backend renames were applied to live Supabase and verified
  (2026-07-17):** `nestor-intent` deployed and `copilot-intent` deleted; the
  rate-limit table renamed via `0003_rename_copilot_requests_to_nestor.sql` —
  verified with the service-role key that `nestor_requests` exists carrying its
  91 rows forward and `copilot_requests` is gone (PGRST205). A repo rename does
  not rename deployed infrastructure, so both needed doing by hand. 0002
  deliberately still creates `copilot_requests`: it was already applied to the
  live database, so the rename is a forward migration, not an edit to history.
  The fallback path is unchanged — if the function or Gemini is unavailable,
  `deriveIntentAsync` still drops to the local regex parser. One UX fix fell out of
  the rename: the `/decision-report` empty-state CTA was briefly also labelled
  "Ask Nestor", colliding with the identically-named header nav link (two
  same-named links to the same route — ambiguous for screen readers, and a
  Playwright strict-mode violation); it now reads "Start with Nestor".

- **QA pass — full Playwright E2E suite + bug fixes (2026-07-17):** a
  full-app QA sweep (`tests/*.spec.ts`, 65 tests × 6 projects — Chromium,
  Firefox, WebKit, tablet, Mobile Chrome, Mobile Safari — 390 runs, all
  green) covering every route, filter/search, Nestor (including
  Gemini-outage and rate-limit fallback), compare, shortlist, theming, 404s,
  and an automated axe-core accessibility scan. Found and fixed real bugs:
  (1) the Explore filter `<select>`s and property-gallery thumbnail buttons
  had no accessible name (critical axe violations) — added `aria-label`s;
  (2) every route shared one static "HomeHunt AI" document title with no
  per-page SEO differentiation — added `useDocumentTitle`
  (`src/lib/use-document-title.ts`), wired into every page; (3) the router
  statically imported every route including Nestor, which still pulls
  in the ~5.7MB local listings seed (see Phase 6 below) — this put that
  whole payload on *every* page's initial load and, concretely, hung
  Firefox indefinitely on a page reload waiting for that module to finish
  fetching. Fixed via route-level code-splitting (`React.lazy` + a
  `Suspense` boundary in `root-layout.tsx`), which also cut the initial JS
  payload from ~6MB to ~766KB (Nestor's chunk now loads only when a user
  opens `/nestor`) — a meaningful, verified head start on Phase 6. No
  authentication exists in this app (confirmed by reading the codebase), so
  auth/session flows were out of scope for this pass.
- **Phase 5 — UX improvements:**
  - **Visual fit meter** — each Nestor pick gets a collapsed-by-default "Fit
    breakdown" disclosure (`PickCard` in `nestor-page.tsx`) showing Budget,
    Commute, Lifestyle, Family, and Investment as 0–100 bars, alongside the
    Overall Fit % already shown. `fit-meter.ts` builds the bars by reusing
    `aiInsights` directly and `lifestyleScore` (newly exported from
    `comparison.ts`, previously private) — only Budget needed new logic
    (`budgetFitScore`), since it has to read against the brief's price
    ceiling rather than an absolute score. The bar UI itself
    (`components/ui/score-bar.tsx`) was extracted from `PropertyDetailPage`'s
    local `ScoreBar` so both places share one implementation. `PickCard` was
    restructured to the same stretched-link pattern `PropertyCard` already
    used (an absolute `z-10` Link covering the card, interactive controls at
    `z-20`) so the new disclosure toggle doesn't trigger navigation —
    verified with Playwright that both the collapsed card and the toggle
    button behave correctly (card still navigates; toggle doesn't).
  - **URL-synced filters** — `FilterBar` now writes filters back to the URL
    (`filtersToParams`, `history: replace` so typing doesn't spam browser
    history) in the same debounced effect that already pushed filters to
    `ExplorePage`, on top of the existing one-time URL seed from Nestor
    hand-off. Verified a filter change updates the URL and survives a
    refresh.
  - **Saved shortlist** — a new `shortlist-context.tsx` (`ShortlistProvider`/
    `useShortlist`, unlimited size, localStorage-persisted under
    `homehuntai:shortlist`) mirrors the existing `compare-context.tsx`
    pattern. A heart toggle sits bottom-left on `PropertyCard` (mirroring the
    existing bottom-right Compare toggle) and in the `PropertyDetailPage`
    sidebar. `/shortlist` (`shortlist-page.tsx`) lists saved homes via the
    existing `usePropertiesByIds` hook — "compare shortlisted homes" is
    satisfied by reusing each card's existing Compare toggle rather than
    building a second mechanism. Note: Nestor's `PickCard` doesn't get a
    shortlist heart, consistent with it also not having a Compare toggle
    today.
  - **Mobile navigation** — a fixed bottom tab bar (`MobileNav` in
    `root-layout.tsx`, `sm:hidden`) replaces the previously-hidden mobile nav
    dead end, with Home/Explore/Nestor/Shortlist tabs (Shortlist carries a
    count badge, mirrored on the desktop nav too). `<main>` gained mobile-only
    bottom padding (`pb-24 sm:pb-8`) and `CompareTray` shifted up
    (`bottom-20 sm:bottom-4`) so neither is hidden behind the new bar.
  - Verified all four in-browser with Playwright (desktop + a 390px mobile
    viewport): filter URL sync + refresh persistence, shortlist toggle +
    `/shortlist` page + badge count, fit-meter bars rendering without
    breaking card navigation, and the mobile tab bar navigating correctly.

- **Nestor Phase 4 — lifestyle-based search:** natural lifestyle statements
  ("we're expecting our first baby", "I work remotely", "my parents will stay
  with us", "we have a dog") now convert into AI priorities automatically.
  `LIFE_STAGES` in `reasoning.ts` (already the Phase 1/2 home for phrases like
  "newly married" and "retiring") gained four more entries — Expecting /
  planning a family, Multigenerational household, Remote / work-from-home,
  Pet owner — each pairing a phrase pattern with the dimensions it implies
  and a display `label`. `parsePriorities` now also returns matched
  `lifestyleTags`, carried on `NestorIntent` and merged turn-over-turn in
  `refineIntent` (`dedupe`), so a lifestyle detail mentioned once stays
  remembered across follow-ups. Reused the existing Phase 1 editable-priority
  chips for the "let users edit before regenerating" requirement rather than
  building a second editor; added a read-only "Read from your lifestyle:"
  tag row above them (`PriorityEditor` in `nestor-page.tsx`) so users see
  *why* those dimensions were inferred, and the same line surfaces in the
  Decision Report's "AI Understanding" section (`buildUnderstanding` in
  `decision-report.ts`). Verified in-browser with Playwright: a brief
  combining all four new phrases correctly showed all four tags and drove
  sensible rankings, with no console errors.

- **Nestor Phase 3 — comparison + Decision Report:**
  - **Compare homes (2–3 side by side)** — a site-wide compare selection
    (`compare-context.tsx`: `CompareProvider`/`useCompare`, max 3,
    localStorage-persisted) surfaced via a "Compare" toggle on `PropertyCard`
    (Explore grid, restructured to a stretched-link pattern so the toggle isn't
    nested inside the card's anchor) and an "Add to comparison" button on
    `PropertyDetailPage`. A floating `CompareTray` (`root-layout.tsx`) tracks
    the selection app-wide and links to `/compare?ids=a,b,c`
    (`compare-page.tsx`), which renders the homes side by side plus a
    deterministic scoring engine (`comparison.ts`): Budget, Commute, Investment
    Potential, Family Friendliness, Lifestyle Fit (avg of walkability/
    nightlife/green), and Amenities are each normalised 0–100 (budget inverted
    — cheapest scores highest), averaged into a composite, and the winner gets
    a "Best overall" badge plus a reasoning paragraph and runner-up notes.
  - **Decision Report** — `decision-report.ts` packages an existing
    `NestorAnswer` (no new scoring, just structuring what the reasoning
    engine already produced) into User Requirements, AI Understanding, Top
    Recommendation, Strengths, Trade-offs, Alternative Options, Final
    Recommendation. Reached via a "View Decision Report" button on any Nestor
    answer, which navigates to `/decision-report`
    (`decision-report-page.tsx`) passing the answer through React Router
    location state — no backend, no persistence needed.
  - `joinClauses` (prose-joining helper) moved from `reasoning.ts` to the
    shared `lib/utils.ts` so `comparison.ts` and `decision-report.ts` could
    reuse it without duplication.

- **Nestor fix — infer Buy vs Rent from the price unit** — a brief like
  "high-investment 2 BHK apartment in Pune under 90 Lakh" names no explicit
  "buy"/"rent" word, so `listingType` stayed unset and the ₹90L ceiling
  matched Rent listings too — `price` is a *monthly rent* for those, so it
  trivially cleared a lakh-scale ceiling and rentals crowded out sale
  listings in the results. `parseMaxPriceDetailed` (`reasoning.ts`) now
  reads the amount's unit as a type signal — lakh/crore implies **Buy**,
  bare thousands (`k`) implies **Rent** — used as a fallback in both
  `parseIntent` (first turn) and `refineIntent` (follow-ups, only when the
  message itself names no explicit type). An explicit "buy"/"rent" word
  still always wins.

- **Nestor Phase 2 — better decision-making** — each pick now explains itself
  three ways: (a) a **"Why this home"** strengths list (`buildStrengths`) —
  plain-language reasons drawn from the user's own priorities first, topped up
  with the home's standout traits, with the raw 0–100 scores kept internal
  (`STRENGTH_PHRASES`, tiered at ≥80/≥65); (b) a **confidence basis**
  (`buildConfidenceBasis`) — the fit % is now grounded in a sentence ("Based on
  a strong match on your top priority (safety) and comfortable budget
  headroom"), naming top-priority alignment, budget headroom, and caveats
  (inferred priorities, widened filters); (c) **"Why weren't these
  recommended?"** (`findNearMisses`) — a collapsible list of strong homes
  (high fit) that missed by *exactly one* flexible constraint (budget, city,
  BHK, or ruled-out type), each with the reason, so the user can decide what to
  flex. Budget near-misses are capped at 30% over (`NEAR_BUDGET_CEILING`) so a
  home 3× the budget never shows as "near". Rentals are never surfaced as
  near-misses for a purchase. All deterministic. UI: `PickCard` shows a
  checked strengths list + a Scale trade-off row + a ShieldCheck confidence
  line; `RejectedSection` is an animated disclosure under each answer.

- **Nestor** (`/nestor`) — chat-style UI over a **local reasoning engine**
  (`src/features/nestor/reasoning.ts`, no backend/LLM). Parses a free-text
  brief (listing type, city/region, ₹ budget incl. `cr`/`lakh`/`k`, BHK,
  property type, priorities + life-stage phrases), ranks listings by weighted
  fit against `aiInsights` (first-named priority weighted highest), and
  explains each pick with strengths + a concrete trade-off. Progressive filter
  relaxation guarantees enough results; picks deep-link into detail pages.
  Deterministic — same brief, same answer. Starter example chips, typing
  indicator, keyboard submit.
- **Nestor multi-turn memory** — Nestor now carries structured
  conversation state (the last turn's `NestorIntent`, in a `lastIntentRef`),
  so follow-ups refine the previous search instead of resetting. `refineIntent`
  merges a new message onto the prior intent: relative budget nudges ("make it
  cheaper" → ×0.8, "increase the budget" → ×1.25), city/BHK/type overrides,
  "any city"/"any type" resets, negations ("I don't want apartments" →
  `excludedPropertyTypes`; "don't care about nightlife" → drops the dimension),
  and priority merges (newly named priorities move to the front). Negation is
  read before the positive parse so "no apartments" never sets an Apartment
  filter. Refined replies lead with "Updated your search." Still fully
  deterministic.
- **Nestor → Explore hand-off** — every answer has a "View these in Explore"
  action that maps the current `NestorIntent` onto Explore's filters via URL
  query params (`src/features/properties/filter-params.ts`, enum-validated on
  read). `FilterBar` seeds its form from the URL once on mount and injects a
  custom price/BHK option when the handed-off value isn't a preset, so the
  exact budget shows. Filters now also write back to the URL as they change
  (Phase 5's URL-synced filters), so the hand-off and manual searches both
  end up shareable.
- **Nestor editable priorities** — each answer shows its detected priorities
  as chips (ordered by weight, first counts most): remove active ones (last one
  locked), add from the remaining dimensions. Any change re-ranks in place via
  `rerankIntent` — no re-parsing, and it carries into the next turn's memory.
- **Foundation:** routing shell, root layout + nav, theming (light/dark),
  design tokens, TanStack Query provider.
- **Data layer:** 2,000-listing Supabase-backed `properties` table, `api.ts`
  queries Supabase directly (filterable server-side) behind typed query
  hooks (`useProperties`, `useProperty`, `usePropertiesByIds`). Local Zod
  seed validation (`data/listings.ts`) is still used by `reasoning.ts`
  until Phase 3.
- **Home page:** marketing hero + feature cards.
- **Explore page** (`/explore`): responsive card grid, `react-hook-form`
  filter bar (search, Buy/Rent, city, type, BHK, max price), loading
  skeletons, empty/error states, "Load more" paging (24/page), ₹ lakh/crore
  formatting (`formatINR`).
- **Property detail page** (`/property/:id`): image gallery with thumbnails,
  key specs grid, description + highlights, amenities, nearby landmarks,
  sticky sidebar (price, agent contact via `tel:`/`mailto:`, neighborhood
  intel score bars), loading + not-found states. Cards link into it.

### Not started / stubbed

- **Phases 1–5 are complete** — Phase 1 (multi-turn memory, Explore
  hand-off, editable priorities), Phase 2 (Why this home, confidence basis,
  near-miss explanations), Phase 3 (Compare homes, Decision Report), Phase 4
  (lifestyle-based search), and Phase 5 (visual fit meter, URL-synced
  filters, saved shortlist, mobile navigation) are all shipped. **Phase 6
  (performance)** is next — and last on the current roadmap.

---

## What to do next

0. **Stack migration Phase 4 — deploy to Vercel + Supabase** *(most urgent —
   gets a live hosted URL for the 2026-07-19 hackathon deadline)*. See the
   "Planned stack migration" section above.
1. **Phase 6 — performance** *(next up, last roadmap phase)* — the
   2026-07-17 QA pass route-split the app (see above), so the 2,000-listing
   JSON no longer loads on every page — only `/nestor`. It's still a single
   ~5.1MB chunk fetched in one shot the first time a user opens Nestor
   (`npm run build` still warns on that chunk specifically), and `reasoning.ts`
   still ranks against this static local snapshot rather than live Supabase
   data (a second source of truth vs. Explore, which already queries Supabase
   — see the Phase 3 architecture note above). Fetching the JSON as a static
   asset instead of a JS import, or having Nestor query Supabase
   directly, remains open.
2. **Possible follow-ups beyond the roadmap:** a shortlist heart on the
   Nestor's `PickCard` (currently Explore/detail-page only, matching that
   Compare is also absent there today — see Phase 5 notes above); clearing
   individual/all shortlist items from `/shortlist` beyond un-hearting each
   card; a proper mobile drawer if the 4-tab bottom bar ever needs a 5th
   item.

---

## Conventions

- After writing code, run `npm run build`. When it passes, update the
  "Current stage" and "What to do next" sections above and refresh the
  "Last verified build" date.
- Keep everything typechecking (`tsc -b`) and lint-clean (`npm run lint`);
  the one standing warning is pre-existing in `src/components/ui/button.tsx`.
