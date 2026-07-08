-- Correctif : réapplique GRANTS + policies RLS sur les tables training.
-- Idempotent — sûr à rejouer. Corrige « permission denied for table training_plans ».

grant usage on schema public to authenticated, anon;

-- GRANTS (rôle authenticated = utilisateur connecté)
grant select, insert, update, delete on training_plans    to authenticated;
grant select, insert, update, delete on training_weeks    to authenticated;
grant select, insert, update, delete on training_sessions to authenticated;
grant select, insert, update, delete on session_steps     to authenticated;

-- Privilèges par défaut pour les futures tables du schéma public
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Policies RLS (drop + recreate pour garantir leur présence)
alter table training_plans    enable row level security;
alter table training_weeks    enable row level security;
alter table training_sessions enable row level security;
alter table session_steps     enable row level security;

drop policy if exists "user gère ses plans"    on training_plans;
drop policy if exists "user gère ses semaines" on training_weeks;
drop policy if exists "user gère ses séances"  on training_sessions;
drop policy if exists "user gère ses steps"    on session_steps;

create policy "user gère ses plans" on training_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses semaines" on training_weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses séances" on training_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses steps" on session_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
