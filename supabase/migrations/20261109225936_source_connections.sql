-- Lot Src1 : sources de données côté serveur.
-- coros_tokens devient source_connections, une ligne par compte et par source
-- (provider), pour accueillir d'autres sources que Coros plus tard. La RLS reste
-- active sans règle : seule la service_role lit et écrit les jetons.
-- Une vue coros_tokens garde l'ancien nom le temps du déploiement des Edge
-- Functions ; elle est supprimée par la migration suivante (drop_coros_tokens_view).

-- ── source_connections ───────────────────────────────────────────────────────
alter table public.coros_tokens rename to source_connections;
alter table public.source_connections rename constraint coros_tokens_user_id_fkey to source_connections_user_id_fkey;

alter table public.source_connections add column provider text not null default 'coros';

alter table public.source_connections drop constraint coros_tokens_pkey;
alter table public.source_connections add constraint source_connections_pkey primary key (user_id, provider);

-- Droits inchangés par le renommage : rien pour anon et authenticated, service_role seule.
alter table public.source_connections enable row level security;
revoke all on public.source_connections from anon, authenticated;

-- ── vue de transition coros_tokens ───────────────────────────────────────────
create view public.coros_tokens with (security_invoker = true) as
  select user_id, access_token, refresh_token, expires_at
  from public.source_connections
  where provider = 'coros';

revoke all on public.coros_tokens from anon, authenticated;
grant select, insert, update, delete on public.coros_tokens to service_role;

-- ── coros_oauth_state.return_path ────────────────────────────────────────────
-- Chemin de l'app où revenir après la connexion. Toujours un chemin interne :
-- un seul / en tête, ni //, ni \, ni caractère de contrôle, 200 caractères au plus
-- (même règle que _shared/sources/retour.ts).
alter table public.coros_oauth_state add column return_path text null;
alter table public.coros_oauth_state add constraint coros_oauth_state_return_path_check check (
  return_path is null or (
    left(return_path, 1) = '/'
    and position('//' in return_path) = 0
    and position(E'\\' in return_path) = 0
    and return_path !~ '[[:cntrl:]]'
    and char_length(return_path) <= 200
  )
);

-- ── training_plans.source ────────────────────────────────────────────────────
-- Source de données du plan, posée à la création (generate-plan). Les plans
-- existants ont tous été faits avec Coros.
alter table public.training_plans add column source text null;
update public.training_plans set source = 'coros' where source is null;
