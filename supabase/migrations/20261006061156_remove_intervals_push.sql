-- Retrait d'Intervals.icu : le push utilisait une cle et un athlete globaux,
-- incompatibles avec le multi-utilisateur. Les colonnes de suivi disparaissent.
alter table public.training_sessions
  drop column if exists intervals_event_id,
  drop column if exists pushed_at;
