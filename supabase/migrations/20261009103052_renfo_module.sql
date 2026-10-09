-- Module Renfo autonome : profil (fréquence, matériel), inventaire d'élastiques,
-- cycles de 4 semaines et séances. Planning indépendant du plan course Training.
--
-- Droits authenticated (les privilèges par défaut donnent select, insert,
-- update, delete, migration 20261007141949_fix_table_grants) :
-- - strength_profiles, strength_bands : tout, filtré par la RLS ;
-- - strength_cycles : lecture seule, écriture par les Edge Functions (service_role) ;
-- - strength_sessions : lecture, mise à jour du suivi uniquement (statut,
--   feedback, bandes jouées), suppression des seules séances libres, pas d'insert.

-- ── strength_profiles ────────────────────────────────────────────────────────
create table public.strength_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  frequency smallint not null default 2 check (frequency between 1 and 3),
  -- Les élastiques sont dans strength_bands.
  equipment text[] not null default '{}' check (equipment <@ array['chair', 'bar']::text[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strength_profiles enable row level security;
create policy "user gère son profil renfo" on public.strength_profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.strength_profiles to authenticated;

-- ── strength_bands ───────────────────────────────────────────────────────────
create table public.strength_bands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kg numeric not null check (kg > 0),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, kg)
);

alter table public.strength_bands enable row level security;
create policy "user gère ses élastiques" on public.strength_bands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.strength_bands to authenticated;

-- ── strength_cycles ──────────────────────────────────────────────────────────
create table public.strength_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  number int not null,
  -- Un lundi.
  start_date date not null,
  -- Figée à la création du cycle.
  frequency smallint not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  generation_status text not null default 'generating'
    check (generation_status in ('generating', 'ready', 'error')),
  generated_weeks smallint not null default 0,
  -- Exercices principaux figés pour le cycle, par type de séance : { "legs": ["slug", ...] }.
  main_exercises jsonb,
  created_at timestamptz not null default now()
);

create unique index strength_cycles_one_active_idx
  on public.strength_cycles (user_id) where status = 'active';

alter table public.strength_cycles enable row level security;
create policy "user gère ses cycles renfo" on public.strength_cycles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke insert, update, delete on public.strength_cycles from authenticated;
grant select on public.strength_cycles to authenticated;

-- ── strength_sessions ────────────────────────────────────────────────────────
create table public.strength_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null pour une séance libre.
  cycle_id uuid references public.strength_cycles(id) on delete cascade,
  week_index smallint check (week_index between 1 and 4),
  -- Lundi de la semaine, pas de jour imposé.
  week_start date not null,
  -- Ordre dans la semaine.
  position smallint not null default 0,
  kind text not null
    check (kind in ('full', 'lower_core', 'upper_core', 'legs', 'upper', 'core_runner')),
  title text not null,
  content jsonb not null,
  status text not null default 'planned' check (status in ('planned', 'done')),
  completed_at timestamptz,
  -- Bande réellement jouée : { "<slug>": <kg> }.
  bands_used jsonb,
  rpe smallint check (rpe between 1 and 10),
  pain_areas text[],
  feedback_note text,
  created_at timestamptz not null default now(),
  check ((cycle_id is null) = (week_index is null))
);

create index strength_sessions_user_week_idx on public.strength_sessions (user_id, week_start);
create index strength_sessions_cycle_idx on public.strength_sessions (cycle_id);

alter table public.strength_sessions enable row level security;
create policy "user gère ses séances renfo" on public.strength_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Policy restrictive : combinée en ET avec la précédente, une séance de cycle
-- n'est jamais supprimable côté client, seule une séance libre l'est.
create policy "user supprime ses séances libres" on public.strength_sessions
  as restrictive for delete using (cycle_id is null);

revoke insert, update on public.strength_sessions from authenticated;
grant select, delete on public.strength_sessions to authenticated;
grant update (status, completed_at, bands_used, rpe, pain_areas, feedback_note)
  on public.strength_sessions to authenticated;
