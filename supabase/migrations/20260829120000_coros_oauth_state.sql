-- Etats OAuth 2.1 PKCE en attente pour la connexion Coros.
-- Seule la service_role y accede (Edge Function coros-oauth), et la service_role
-- contourne RLS : aucune policy n'est necessaire.
create table if not exists coros_oauth_state (
  state         text primary key,
  code_verifier text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table coros_oauth_state enable row level security;

create index if not exists coros_oauth_state_created_at_idx
  on coros_oauth_state (created_at);
