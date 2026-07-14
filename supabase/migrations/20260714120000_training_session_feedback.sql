-- Ressenti post-séance (RPE) sur training_sessions.
-- Saisi à la complétion, avant l'appel à complete-session, pour que le verdict
-- Haiku puisse l'intégrer et que l'adaptation en tienne compte. Colonnes
-- nullables, sans défaut. Aucune incidence RLS/grants.
--   rpe          : effort perçu 1 à 10 (échelle athlète)
--   pain_areas   : tableau de codes de zones douloureuses (ex ["mollet_g","genou_d"])
--   feedback_note: commentaire libre optionnel

alter table training_sessions
  add column if not exists rpe smallint check (rpe between 1 and 10),
  add column if not exists pain_areas jsonb,
  add column if not exists feedback_note text;
