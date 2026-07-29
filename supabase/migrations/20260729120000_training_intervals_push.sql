-- Envoi d'une seance de course vers Intervals.icu (qui synchronise ensuite vers
-- la montre Coros). On garde l'identifiant de l'event cree pour pouvoir le
-- mettre a jour au lieu d'en creer un doublon apres une adaptation de seance.
alter table training_sessions
  add column if not exists intervals_event_id text,
  add column if not exists pushed_at timestamptz;
