-- Backfill : ajoute la récupération manquante apres la derniere répétition des
-- blocs de fractionné. La convention initiale sautait la récup finale, mais la
-- montre Coros enregistre bien un lap de récup apres le dernier intervalle, ce
-- qui décalait l'appariement steps <-> laps.
--
-- PÉRIMÈTRE : seances NON FAITES uniquement (status <> 'done'). Les seances
-- 'done' portent des index positionnels (analysis.comparisons[].step_index,
-- actual_laps[].step_index) ; y insérer un step décalerait ces références et
-- corromprait l'analyse déjà calculée. On les laisse strictement intactes.
--
-- La contrainte unique (session_id, order_index) n'est PAS deferrable : un
-- simple order_index = order_index + 1 échouerait sur une collision transitoire.
-- Le décalage se fait donc en deux passes avec un offset large intermédiaire.
--
-- Idempotent : relancer la migration ne réinsere rien (garde sur repeat_index).

do $$
declare
  grp             record;
  tmpl            record;
  n_max           int;
  last_iv_order   int;
  offset_big      constant int := 1000000;
begin
  for grp in
    select distinct ss.session_id, ss.repeat_group
    from session_steps ss
    join training_sessions ts on ts.id = ss.session_id
    where ts.status <> 'done'
      and ss.repeat_group is not null
      and ss.step_type = 'interval'
  loop
    -- N = plus grand repeat_index parmi les intervalles du groupe.
    select max(repeat_index) into n_max
    from session_steps
    where session_id = grp.session_id
      and repeat_group = grp.repeat_group
      and step_type = 'interval';

    -- Une récup avec repeat_index = N existe deja : rien a faire (idempotence).
    if exists (
      select 1 from session_steps
      where session_id = grp.session_id
        and repeat_group = grp.repeat_group
        and step_type = 'recovery'
        and repeat_index = n_max
    ) then
      continue;
    end if;

    -- Gabarit = la récup du groupe au plus petit order_index. Aucune récup dans
    -- le groupe : bloc volontairement sans récup, on ne touche a rien.
    select target_pace_sec, pace_tolerance_sec, distance_m, duration_sec, user_id
    into tmpl
    from session_steps
    where session_id = grp.session_id
      and repeat_group = grp.repeat_group
      and step_type = 'recovery'
    order by order_index
    limit 1;

    if not found then
      continue;
    end if;

    -- Position du dernier intervalle (repeat_index = N) : la récup s'insere juste
    -- apres lui.
    select order_index into last_iv_order
    from session_steps
    where session_id = grp.session_id
      and repeat_group = grp.repeat_group
      and step_type = 'interval'
      and repeat_index = n_max
    order by order_index desc
    limit 1;

    -- Décalage +1 des order_index suivants, en deux passes (offset large pour
    -- éviter toute collision sur la contrainte unique non deferrable).
    update session_steps
    set order_index = order_index + offset_big
    where session_id = grp.session_id
      and order_index > last_iv_order;

    update session_steps
    set order_index = order_index - offset_big + 1
    where session_id = grp.session_id
      and order_index > last_iv_order + offset_big;

    -- Insertion de la récup finale, copie du gabarit, juste apres le dernier
    -- intervalle.
    insert into session_steps
      (user_id, session_id, order_index, step_type, repeat_group, repeat_index,
       target_pace_sec, pace_tolerance_sec, distance_m, duration_sec)
    values
      (tmpl.user_id, grp.session_id, last_iv_order + 1, 'recovery',
       grp.repeat_group, n_max,
       tmpl.target_pace_sec, tmpl.pace_tolerance_sec, tmpl.distance_m, tmpl.duration_sec);
  end loop;
end $$;
