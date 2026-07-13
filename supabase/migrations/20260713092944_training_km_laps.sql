-- Ajoute training_sessions.km_laps : laps auto-kilomètre bruts de Coros
-- (groupe lapDistance=100000 centièmes de mètre = 1 km), conservés à la
-- complétion pour la vue "par km" du graphe d'allure. Purement visuel : le
-- verdict et l'analyse restent basés exclusivement sur actual_laps.
-- Colonne nullable, sans défaut. Aucune incidence RLS/grants.

alter table training_sessions
  add column if not exists km_laps jsonb;
