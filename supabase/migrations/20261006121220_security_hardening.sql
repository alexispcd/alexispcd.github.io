-- Durcissement sécurité avant ouverture à d'autres comptes.

-- ── coros_tokens ─────────────────────────────────────────────────────────────
-- Accès réservé à la service_role (Edge Functions via le client admin). RLS reste
-- activée sans aucune policy : anon et authenticated ne voient ni n'écrivent rien.
drop policy if exists "user voit ses tokens" on public.coros_tokens;

-- ── rls_auto_enable ──────────────────────────────────────────────────────────
-- Fonction d'event trigger : aucun rôle client n'a à l'exécuter.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ── set_user_modules ─────────────────────────────────────────────────────────
-- Remplace les modules d'un compte en une seule transaction. Appelée par
-- admin-users (service_role) ; les ids sont validés en amont contre modules.ts.
create or replace function public.set_user_modules(p_user_id uuid, p_modules text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_modules where user_id = p_user_id;
  insert into public.user_modules (user_id, module_id)
  select p_user_id, m.module_id
  from unnest(coalesce(p_modules, '{}'::text[])) as m(module_id)
  on conflict do nothing;
end;
$$;

revoke all on function public.set_user_modules(uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_user_modules(uuid, text[]) to service_role;
