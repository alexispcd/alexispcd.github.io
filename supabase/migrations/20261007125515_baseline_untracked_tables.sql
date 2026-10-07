-- Migration de rattrapage : coros_tokens, user_preferences, watch_items et rss_feeds
-- existaient en prod sans aucune migration. Recréées ici exactement comme relevées le
-- 2026-10-07 (colonnes, contraintes, RLS, policies, droits), pour que le schéma soit
-- reproductible. Appliquée à la prod, elle ne change rien.
--
-- Hors périmètre volontaire :
-- - le cron fetch-rss-daily (sa commande contient un JWT en dur, voir CLAUDE.md) ;
-- - rls_auto_enable() et son event trigger ensure_rls, posés hors repo.
--
-- Les droits sont reproduits tels quels, anomalies comprises (voir le rapport du
-- chantier qualité) : TRUNCATE, REFERENCES, TRIGGER et MAINTAIN pour anon, et
-- service_role sans SELECT ni écriture sur user_preferences, watch_items et rss_feeds.
-- Les corriger relève d'une migration dédiée.

-- ── coros_tokens ─────────────────────────────────────────────────────────────
-- Accès réservé à la service_role : RLS activée sans policy (migration
-- 20261006121220_security_hardening).
create table if not exists public.coros_tokens (
  user_id       uuid not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  constraint coros_tokens_pkey primary key (user_id),
  constraint coros_tokens_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.coros_tokens enable row level security;

revoke all on public.coros_tokens from anon, authenticated, service_role;
grant truncate, references, trigger, maintain on public.coros_tokens to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on public.coros_tokens to authenticated;
grant select, insert, update, delete, truncate, references, trigger, maintain on public.coros_tokens to service_role;

-- ── user_preferences ─────────────────────────────────────────────────────────
create table if not exists public.user_preferences (
  user_id uuid not null,
  key     text not null,
  value   text,
  constraint user_preferences_pkey primary key (user_id, key),
  constraint user_preferences_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.user_preferences enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_preferences' and policyname = 'user voit ses prefs'
  ) then
    create policy "user voit ses prefs" on public.user_preferences
      for all to public using (auth.uid() = user_id);
  end if;
end
$$;

revoke all on public.user_preferences from anon, authenticated, service_role;
grant truncate, references, trigger, maintain on public.user_preferences to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on public.user_preferences to authenticated;
grant truncate, references, trigger, maintain on public.user_preferences to service_role;

-- ── watch_items ──────────────────────────────────────────────────────────────
-- Deux policies identiques en prod : reproduites telles quelles.
create table if not exists public.watch_items (
  id           uuid not null default gen_random_uuid(),
  user_id      uuid not null,
  url          text,
  title        text,
  tags         text[],
  read_at      timestamptz,
  source       text,
  published_at timestamptz,
  is_read      boolean not null default false,
  is_favorite  boolean not null default false,
  summary      text,
  key_points   text[],
  note         text,
  constraint watch_items_pkey primary key (id),
  constraint watch_items_url_unique unique (url),
  constraint watch_items_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.watch_items enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_items' and policyname = 'user voit ses articles'
  ) then
    create policy "user voit ses articles" on public.watch_items
      for all to public using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'watch_items' and policyname = 'user voit ses propres items'
  ) then
    create policy "user voit ses propres items" on public.watch_items
      for all to public using (auth.uid() = user_id);
  end if;
end
$$;

revoke all on public.watch_items from anon, authenticated, service_role;
grant truncate, references, trigger, maintain on public.watch_items to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on public.watch_items to authenticated;
grant truncate, references, trigger, maintain on public.watch_items to service_role;

-- ── rss_feeds ────────────────────────────────────────────────────────────────
create table if not exists public.rss_feeds (
  id      uuid not null default gen_random_uuid(),
  user_id uuid not null,
  url     text not null,
  name    text,
  theme   text,
  constraint rss_feeds_pkey primary key (id),
  constraint rss_feeds_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);
alter table public.rss_feeds enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rss_feeds' and policyname = 'user voit ses flux'
  ) then
    create policy "user voit ses flux" on public.rss_feeds
      for all to public using (auth.uid() = user_id);
  end if;
end
$$;

revoke all on public.rss_feeds from anon, authenticated, service_role;
grant truncate, references, trigger, maintain on public.rss_feeds to anon;
grant select, insert, update, delete, truncate, references, trigger, maintain on public.rss_feeds to authenticated;
grant truncate, references, trigger, maintain on public.rss_feeds to service_role;
