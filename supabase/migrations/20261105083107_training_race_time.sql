-- Temps réel de la course d'un plan, affiché par l'Historique des séances (lot H1)
-- et saisi plus tard par « Saisir mon temps » (lot T4). En secondes, null tant
-- qu'il n'est pas connu.

alter table public.training_plans
  add column race_time_sec integer check (race_time_sec > 0);

-- Temps réel d'Auray Vannes (activité du 13 septembre 2026). Les autres plans restent vides
-- jusqu'à « Saisir mon temps » (lot T4).
update public.training_plans
set race_time_sec = 6324
where race_name = 'Auray Vannes' and race_date = '2026-09-13';
