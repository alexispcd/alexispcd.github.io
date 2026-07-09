-- Ajoute training_plans.start_date : date de début d'entraînement choisie dans le
-- wizard. Nécessaire pour recalculer les bornes calendaires (semaines alignées
-- lundi→dimanche) lors du chaînage de génération et de la régénération.

alter table training_plans
  add column if not exists start_date date;

-- Backfill des plans existants : première semaine connue, sinon date de création.
update training_plans p
set start_date = coalesce(
  (select min(w.start_date) from training_weeks w where w.plan_id = p.id),
  p.created_at::date
)
where p.start_date is null;
