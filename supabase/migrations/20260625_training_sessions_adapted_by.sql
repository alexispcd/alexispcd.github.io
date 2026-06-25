-- Traçabilité de l'adaptation : référence la séance sautée qui a déclenché l'adaptation
alter table training_sessions
  add column if not exists adapted_by_session_id uuid;
