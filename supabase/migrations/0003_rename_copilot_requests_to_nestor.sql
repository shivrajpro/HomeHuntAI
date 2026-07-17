-- HomeHuntAI: rename copilot_requests -> nestor_requests
-- Follows the rename of the AI assistant from "Copilot" to "Nestor". 0002 is
-- left as it was written: it is already applied to the live database, so the
-- rename has to be a forward migration rather than an edit to history.
--
-- The `nestor-intent` edge function (previously `copilot-intent`) reads and
-- writes this table under the new name, so this must be applied before — or
-- together with — deploying that function. Until it is, the rate-limit check
-- fails open and Nestor falls back to the local regex parser; it degrades,
-- it does not break.

alter table if exists public.copilot_requests
  rename to nestor_requests;

alter index if exists public.copilot_requests_client_key_created_at_idx
  rename to nestor_requests_client_key_created_at_idx;
