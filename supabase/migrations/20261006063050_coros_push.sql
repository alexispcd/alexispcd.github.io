-- Envoi des séances de course vers la montre via le MCP Coros.
-- coros_workout_id : idInPlan Coros (entier 64 bits, gardé en texte).
-- coros_workout_date : date de la copie sur Coros (peut différer de scheduled_date).
-- coros_sync_error : dernier échec de mise à jour automatique, message court en français.
alter table public.training_sessions
  add column coros_workout_id text,
  add column coros_workout_date date,
  add column coros_pushed_at timestamptz,
  add column coros_sync_error text;
