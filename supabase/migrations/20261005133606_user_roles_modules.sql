-- Rôles et droits par module (Le Cairn multi-utilisateur).
-- Idempotent : sûr à rejouer.

-- ── profiles ─────────────────────────────────────────────────────────────────
-- La table existe en prod sans migration : recréée ici à l'identique si absente.
create table if not exists public.profiles (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text
);
alter table public.profiles enable row level security;

alter table public.profiles add column if not exists role text not null default 'user';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'admin'));

-- Lecture seule de sa propre ligne. Aucune policy d'écriture : personne ne
-- modifie son propre rôle, seule la service_role écrit.
drop policy if exists "user voit ses propres données" on public.profiles;
drop policy if exists "user lit son profil" on public.profiles;
create policy "user lit son profil" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- TRUNCATE contourne la RLS : on retire tout avant de rendre la lecture.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- ── Création automatique du profil ───────────────────────────────────────────
-- Schéma private non exposé par l'API : la fonction n'est pas appelable via /rest/v1/rpc.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill des comptes existants (rôle user par défaut).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ── user_modules ─────────────────────────────────────────────────────────────
create table if not exists public.user_modules (
  user_id    uuid not null references auth.users(id) on delete cascade,
  module_id  text not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, module_id)
);
alter table public.user_modules enable row level security;

drop policy if exists "user lit ses modules" on public.user_modules;
create policy "user lit ses modules" on public.user_modules
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.user_modules from anon, authenticated;
grant select on public.user_modules to authenticated;
grant select, insert, update, delete on public.user_modules to service_role;

-- Backfill : chaque compte existant garde les deux modules visibles aujourd'hui.
insert into public.user_modules (user_id, module_id)
select u.id, m.module_id
from auth.users u
cross join (values ('cotes'), ('training')) as m(module_id)
on conflict do nothing;
