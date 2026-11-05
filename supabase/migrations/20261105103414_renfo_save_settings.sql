-- Réglages Renfo enregistrés d'un coup (lot R5) : objectif, matériel, élastiques et
-- report des bases d'exercices vers les nouveaux poids, tout ou rien.
-- Les élastiques sont tous remplacés : on peut ainsi échanger deux poids malgré
-- l'unicité (user_id, kg). Leurs id changent, aucune clé étrangère ne pointe dessus.
-- security invoker : la RLS et les droits authenticated des trois tables s'appliquent.

create or replace function public.renfo_enregistrer_reglages(
  p_frequency int, p_equipment text[], p_bands jsonb, p_report jsonb
) returns void
language plpgsql security invoker set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Non authentifié'; end if;
  insert into strength_profiles (user_id, frequency, equipment, updated_at)
    values (uid, p_frequency, p_equipment, now())
    on conflict (user_id) do update
      set frequency = excluded.frequency, equipment = excluded.equipment, updated_at = now();
  delete from strength_bands where user_id = uid;
  insert into strength_bands (user_id, kg, color)
    select uid, b.kg, b.color from jsonb_to_recordset(p_bands) as b(kg numeric, color text);
  update strength_exercise_bases e
    set band_kg = r.vers, updated_at = now()
    from jsonb_to_recordset(p_report) as r(de numeric, vers numeric)
    where e.user_id = uid and e.band_kg = r.de;
end $$;
revoke all on function public.renfo_enregistrer_reglages(int, text[], jsonb, jsonb) from public, anon;
grant execute on function public.renfo_enregistrer_reglages(int, text[], jsonb, jsonb) to authenticated;
