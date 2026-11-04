-- Lot R1 : nouveau modèle Renfo, séances composées à la carte, sans cycle.
-- strength_exercise_bases garde, par compte et par exercice, le dernier réglage
-- (répétitions ou durée, élastique) : chaque nouvelle séance repart de là, sinon
-- de la référence du catalogue. kind devient facultatif : une séance composée n'a
-- pas de type. Les cycles et l'ancien chemin vivent jusqu'au lot R6.

create table public.strength_exercise_bases (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  reps smallint check (reps between 3 and 30),
  duration_sec smallint check (duration_sec between 10 and 90),
  band_kg numeric check (band_kg > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);
alter table public.strength_exercise_bases enable row level security;
create policy "user gère ses bases renfo" on public.strength_exercise_bases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.strength_exercise_bases to authenticated;
grant select, insert, update, delete on public.strength_exercise_bases to service_role;

alter table public.strength_sessions alter column kind drop not null;

-- Reprise : dernière fois de chaque exercice dans les séances faites.
insert into public.strength_exercise_bases (user_id, slug, reps, duration_sec, band_kg)
with doses as (
  select s.user_id, s.completed_at, s.bands_used, d.dose
  from public.strength_sessions s
  cross join lateral jsonb_array_elements(s.content->'blocks') b
  cross join lateral jsonb_array_elements(
    case when b->>'type' = 'superset' then jsonb_build_array(b->'a', b->'b', b->'c')
         else coalesce(b->'items', '[]'::jsonb) end
  ) as d(dose)
  where s.status = 'done' and jsonb_typeof(d.dose) = 'object'
)
select distinct on (user_id, dose->>'slug')
  user_id, dose->>'slug', (dose->>'reps')::smallint, (dose->>'duration_sec')::smallint,
  coalesce((bands_used->>(dose->>'slug'))::numeric, (dose->>'band_kg')::numeric)
from doses
order by user_id, dose->>'slug', completed_at desc;
