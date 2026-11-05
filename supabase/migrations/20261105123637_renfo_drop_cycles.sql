-- Lot R6b : retrait en base des cycles Renfo. Depuis le lot R6a, plus aucun
-- code ne lit strength_cycles, cycle_id ni week_index, et les données sont
-- basculées. Irréversible, aucune donnée de séance touchée. Sans cascade :
-- la migration échoue si une dépendance inattendue reste.

do $$
begin
  if exists (select 1 from public.strength_cycles)
     or exists (select 1 from public.strength_sessions where cycle_id is not null or week_index is not null) then
    raise exception 'Retrait annulé : des données de cycle existent encore';
  end if;
end $$;

drop policy "user supprime ses séances libres" on public.strength_sessions;
alter table public.strength_sessions drop constraint strength_sessions_check;
alter table public.strength_sessions drop column cycle_id;
alter table public.strength_sessions drop column week_index;
drop table public.strength_cycles;
