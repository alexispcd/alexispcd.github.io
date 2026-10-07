-- Correction des droits sur les tables du schéma public (anomalies relevées au
-- chantier qualité, migration 20261007125515_baseline_untracked_tables).
--
-- Cause : les privilèges par défaut de postgres sur public donnaient à anon
-- TRUNCATE, REFERENCES, TRIGGER et MAINTAIN sur chaque nouvelle table, et à
-- authenticated tous les droits. TRUNCATE contourne la RLS.
--
-- Après cette migration :
-- - anon : aucun droit sur les tables (le front n'en lit aucune sans session) ;
-- - authenticated : SELECT, INSERT, UPDATE, DELETE sur ses tables, filtrés par la
--   RLS ; aucun droit sur coros_tokens et coros_oauth_state (service_role seule) ;
-- - service_role : SELECT, INSERT, UPDATE, DELETE partout, y compris sur
--   user_preferences, watch_items et rss_feeds où ils manquaient (cron fetch-rss).
-- profiles et user_modules sont déjà corrects (migration 20261005133606).

-- ── anon : plus aucun droit ──────────────────────────────────────────────────
revoke all on
  public.coros_oauth_state, public.coros_tokens, public.revision_progress, public.rss_feeds,
  public.session_steps, public.training_plans, public.training_sessions, public.training_weeks,
  public.user_preferences, public.watch_items
from anon;

-- ── authenticated : lecture et écriture filtrées par la RLS, rien d'autre ─────
revoke truncate, references, trigger, maintain on
  public.revision_progress, public.rss_feeds, public.session_steps, public.training_plans,
  public.training_sessions, public.training_weeks, public.user_preferences, public.watch_items
from authenticated;

-- Tables réservées à la service_role (RLS activée sans policy).
revoke all on public.coros_oauth_state, public.coros_tokens from authenticated;

-- ── service_role : droits manquants ──────────────────────────────────────────
grant select, insert, update, delete on
  public.user_preferences, public.watch_items, public.rss_feeds
to service_role;

-- ── Privilèges par défaut : les futures tables naissent sans ces droits ──────
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger, maintain on tables from authenticated;

-- ── watch_items : policy en double ───────────────────────────────────────────
-- « user voit ses articles » et « user voit ses propres items » sont identiques
-- (ALL, using auth.uid() = user_id) : on garde la première.
drop policy if exists "user voit ses propres items" on public.watch_items;
