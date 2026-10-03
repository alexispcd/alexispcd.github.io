-- Training ne génère plus de renfo : suppression de toutes les séances renfo,
-- tous comptes confondus, séances faites comprises.
-- Les contraintes et les valeurs autorisées ("renfo" en zone et en type) restent
-- inchangées : le code renfo partagé est conservé pour le futur module autonome.

-- a. Comptage avant suppression.
do $$
declare
  renfo_count  integer;
  linked_count integer;
begin
  select count(*) into renfo_count
    from training_sessions
   where type = 'renfo' or zone = 'renfo';

  select count(*) into linked_count
    from training_sessions
   where adapted_by_session_id in (
     select id from training_sessions where type = 'renfo' or zone = 'renfo'
   );

  raise notice 'séances renfo à supprimer : %', renfo_count;
  raise notice 'séances liées via adapted_by_session_id : %', linked_count;
end $$;

-- b. adapted_by_session_id référence training_sessions sans on delete : on
--    détache les liens avant la suppression, sinon la contrainte bloquerait.
update training_sessions
   set adapted_by_session_id = null
 where adapted_by_session_id in (
   select id from training_sessions where type = 'renfo' or zone = 'renfo'
 );

-- c. Suppression (session_steps suit par on delete cascade).
delete from training_sessions
 where type = 'renfo' or zone = 'renfo';
