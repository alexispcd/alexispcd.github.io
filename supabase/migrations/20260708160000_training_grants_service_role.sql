-- Correctif : service_role (Edge Functions generate-plan / regenerate-plan /
-- adapt-sessions / complete-session) doit pouvoir écrire dans les tables training.

grant select, insert, update, delete on training_plans    to service_role;
grant select, insert, update, delete on training_weeks    to service_role;
grant select, insert, update, delete on training_sessions to service_role;
grant select, insert, update, delete on session_steps     to service_role;

-- Complète les default privileges pour couvrir aussi service_role
-- (la migration 20260708150000 ne visait que authenticated).
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
