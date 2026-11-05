-- Lot R6a : bascule des données Renfo hors des cycles.
-- Les séances faites sont détachées de leur cycle avant toute suppression
-- (cycle_id est en on delete cascade : supprimer le cycle d'abord effacerait
-- une séance faite). Les séances à faire de cycle et les cycles sont supprimés.
-- Aucune colonne ni table n'est retirée ici : strength_cycles, cycle_id,
-- week_index, leur contrainte et la policy restrictive partent au lot R6b.
-- Irréversible.

do $$
declare avant int; apres int;
begin
  select count(*) into avant from public.strength_sessions where status = 'done';
  update public.strength_sessions set cycle_id = null, week_index = null
    where status = 'done' and cycle_id is not null;
  delete from public.strength_sessions where status = 'planned' and cycle_id is not null;
  delete from public.strength_cycles;
  select count(*) into apres from public.strength_sessions where status = 'done';
  if avant <> apres then
    raise exception 'Bascule annulée : % séances faites avant, % après', avant, apres;
  end if;
end $$;
