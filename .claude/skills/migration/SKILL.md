---
name: migration
description: Écrire et appliquer une migration Supabase du Cairn (schéma, droits, policies RLS, données). À utiliser pour toute modification de la base, même une simple colonne.
---

# migration : écrire, faire valider, appliquer, aligner

La CLI est liée à la prod sans stack locale : tout passe par le MCP Supabase.
Interdits : `supabase db push`, `db reset`, `start`, `seed`, `execute_sql` en écriture.
Bonnes pratiques Postgres (index, types, RLS performante) : skill `supabase-postgres-best-practices`.

## Étapes

1. **État de la prod** : `list_migrations` et `list_tables` (MCP Supabase). Comparer avec `supabase/migrations/`. Tout écart (migration en prod absente du repo, ou l'inverse) : s'arrêter et le signaler.
2. **Écrire le fichier** `supabase/migrations/<YYYYMMDDHHMMSS>_<nom>.sql` (horodatage provisoire, `nom` en snake_case anglais). En tête, un commentaire en français qui dit pourquoi.
3. **Checklist par table touchée** :
   - `enable row level security` et policy explicite (`auth.uid() = user_id`, ou lecture seule de ses lignes).
   - Droits explicites : `authenticated` limité à `select, insert, update, delete` au plus, réduits au besoin réel (update par colonnes si possible). Jamais `truncate`. Rien pour `anon`.
   - Table réservée au serveur : `revoke all ... from authenticated`, accès par service_role uniquement.
   - Contrainte unique non différable (ex. `session_steps (session_id, order_index)`) : décalage en deux passes avec un offset large.
   - Dates : fuseau `Europe/Paris`, jamais de conversion UTC implicite d'une date locale.
4. **Validation** : montrer le SQL complet à Alexis avec l'impact (tables, données existantes, front et fonctions à adapter). Attendre son accord explicite. Pas d'accord, pas d'application.
5. **Appliquer** : `apply_migration` avec `name` = nom du fichier sans horodatage.
   - Si l'appel expire : `list_migrations` pour vérifier que rien n'est passé, puis la même migration via `POST https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/database/migrations` avec `{ name, query }` et `SUPABASE_ACCESS_TOKEN`.
6. **Aligner** : `list_migrations`, puis renommer le fichier local avec la version renvoyée.
7. **Contrôler** : `get_advisors` (security), `list_tables` sur les tables touchées. Signaler tout nouvel avertissement.
8. **Documenter** : mettre à jour la section « Supabase : schéma BDD » du CLAUDE.md.

Ne pas committer : le skill `release` s'en charge, à la demande d'Alexis.
