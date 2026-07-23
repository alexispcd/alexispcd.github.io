-- Complétion multi activités Coros.
-- Une même sortie réelle peut produire plusieurs activités Coros distinctes quand
-- la séance préparée n'a pas été lancée sur la montre (la montre a été relancée en
-- cours de route). On stocke désormais la liste ordonnée des labelId liés.
--
-- coros_activity_id est CONSERVÉE et continue d'être alimentée avec le premier
-- identifiant de la liste, pour ne rien casser dans le front (SessionPage lit encore
-- coros_activity_id pour afficher le bouton "Délier Coros").

alter table training_sessions
  add column if not exists coros_activity_ids text[];
