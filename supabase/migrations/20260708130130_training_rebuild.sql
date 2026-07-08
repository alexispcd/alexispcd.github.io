-- Training rebuild — schéma entièrement versionné et reproductible.
-- Aucune donnée à préserver. Ne touche PAS à coros_tokens ni aux tables Veille.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NETTOYAGE
-- ─────────────────────────────────────────────────────────────────────────────
-- L'ordre de drop est géré par cascade. On drop aussi les nouvelles tables au cas
-- où la migration serait rejouée sur un état partiel (idempotence défensive).
drop table if exists session_steps      cascade;
drop table if exists training_sessions  cascade;
drop table if exists training_weeks      cascade;
drop table if exists training_plans      cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. NOUVELLES TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- training_plans ─────────────────────────────────────────────────────────────
create table training_plans (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now(),

  status            text not null default 'active'
                      check (status in ('active','completed','archived')),
  generation_status text not null default 'generating'
                      check (generation_status in ('generating','ready','error')),
  generation_error  text,

  race_name         text not null,
  race_date         date not null,
  race_distance_m   integer not null,
  race_elevation_m  integer,

  goal_time_sec     integer,

  fitness_snapshot  jsonb,   -- { vo2max, threshold_pace, vma, predictions, source: 'coros'|'manual' }
  previous_races    jsonb,
  notes             text,
  summary           text     -- résumé IA du plan
);

-- Un seul plan actif par utilisateur.
create unique index training_plans_one_active_per_user
  on training_plans (user_id)
  where status = 'active';

-- training_weeks ─────────────────────────────────────────────────────────────
create table training_weeks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),

  plan_id      uuid not null references training_plans on delete cascade,
  week_number  integer not null,
  block        text not null
                 check (block in ('construction','intensification','affutage')),
  focus        text,
  target_km    numeric,
  start_date   date,

  unique (plan_id, week_number)
);

-- training_sessions ──────────────────────────────────────────────────────────
create table training_sessions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  created_at            timestamptz not null default now(),

  plan_id               uuid not null references training_plans on delete cascade,
  week_id               uuid not null references training_weeks on delete cascade,
  scheduled_date        date not null,

  zone                  text not null check (zone in ('A','B','C','renfo')),
  type                  text not null
                          check (type in ('facile','fractionne','tempo','sortie_longue','renfo')),
  title                 text not null,
  rationale             text,   -- justification des allures
  notes                 text,

  status                text not null default 'planned'
                          check (status in ('planned','done','skipped','adapted')),
  completed_at          timestamptz,

  coros_activity_id     text,   -- labelId Coros
  actual_laps           jsonb,  -- laps bruts importés de Coros
  analysis              jsonb,  -- { verdict, advice, comparisons: [] }

  previous_version      jsonb,  -- snapshot avant adaptation (pour unskip)
  adapted_at            timestamptz,
  adapted_by_session_id uuid references training_sessions,

  strength_content      jsonb   -- renfo uniquement :
  -- { target_duration_min, blocks: [{ name, exercises: [{ name, sets, reps?, duration_sec?, rest_sec }] }] }
);

create index training_sessions_plan_id_idx on training_sessions (plan_id);
create index training_sessions_week_id_idx on training_sessions (week_id);

-- session_steps ──────────────────────────────────────────────────────────────
create table session_steps (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  created_at         timestamptz not null default now(),

  session_id         uuid not null references training_sessions on delete cascade,
  order_index        integer not null,
  step_type          text not null
                       check (step_type in ('warmup','run','interval','recovery','cooldown')),

  repeat_group       integer,   -- répétitions aplaties, regroupables à l'affichage
  repeat_index       integer,

  target_pace_sec    integer,   -- secondes par km
  pace_tolerance_sec integer not null default 5,
  distance_m         integer,
  duration_sec       integer,

  unique (session_id, order_index),

  -- un step est borné par une distance OU une durée
  constraint session_steps_distance_or_duration
    check (distance_m is not null or duration_sec is not null),
  -- seule la récup peut être en allure libre
  constraint session_steps_pace_required_unless_recovery
    check (target_pace_sec is not null or step_type = 'recovery')
);

create index session_steps_session_order_idx on session_steps (session_id, order_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS + GRANTS
-- ─────────────────────────────────────────────────────────────────────────────
alter table training_plans    enable row level security;
alter table training_weeks    enable row level security;
alter table training_sessions enable row level security;
alter table session_steps     enable row level security;

create policy "user gère ses plans" on training_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses semaines" on training_weeks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses séances" on training_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user gère ses steps" on session_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on training_plans    to authenticated;
grant select, insert, update, delete on training_weeks    to authenticated;
grant select, insert, update, delete on training_sessions to authenticated;
grant select, insert, update, delete on session_steps     to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CRON — clôture automatique des plans dont la course est passée
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists pg_cron;

-- Idempotence : retire le job s'il existe déjà avant de le (re)planifier.
select cron.unschedule('training-plans-autocomplete')
where exists (select 1 from cron.job where jobname = 'training-plans-autocomplete');

select cron.schedule(
  'training-plans-autocomplete',
  '0 4 * * *',
  $cron$
    update training_plans
       set status = 'completed'
     where status = 'active'
       and race_date < current_date
  $cron$
);
