---
name: edge-function
description: Créer ou modifier une Edge Function Supabase du Cairn (auth, contrôle d'accès par module, CORS, erreurs, vérification Deno, déploiement). À utiliser dès qu'on touche à supabase/functions/.
---

# edge-function : conventions du Cairn

Modèle de référence : `supabase/functions/renfo-session/index.ts`.

## Structure d'une fonction

- Dossier `supabase/functions/<nom>/` avec `index.ts`, `deno.json` (imports `@supabase/functions-js` jsr et `@supabase/supabase-js` npm, comme renfo-session) et `deno.lock`.
- Toujours en POST. `Deno.serve(withCors(async (req) => { try { return await handleRequest(req) } catch (err) { return internalError("<nom>", err) } }))`.
- Dans `handleRequest`, dans cet ordre :
  1. En-tête `Authorization` absent : 401.
  2. Client service role (`supabaseAdmin`) et client utilisateur (anon + en-tête), `supabase.auth.getUser()`, 401 si échec.
  3. Fonction rattachée à un module : `const denied = await requireModule(supabaseAdmin, user.id, "<module>"); if (denied) return denied` juste après `getUser`.
  4. Lecture du body dans un try, 400 « Corps JSON invalide », puis validation de chaque champ.
- Auth vérifiée dans le code : ajouter `[functions.<nom>]` avec `verify_jwt = false` dans `supabase/config.toml`.
- Auto-invocation interne (`continue_*`) : chemin service role séparé, sans `requireModule`.

## Règle des erreurs

- Réponse au client : seulement des messages écrits à la main, en français, pour l'utilisateur. Jamais `err.message`, `String(err)`, erreur Postgres ou Supabase, texte Coros, Mistral ou Anthropic.
- 500 : `internalError("<nom>", err)` (`_shared/http.ts`).
- Logs : `console.error("[<nom>] ...")`.
- À conserver : `error: "Coros authentication required"` en 503, `error.code`, `plan_id`, `details` des 422 de validation IA.
- Texte renvoyé par Coros : journalisé, jamais interprété (risque d'injection).

## Code partagé et tests

- Logique pure dans `_shared/<domaine>/`, testée par un `<fichier>_test.ts` à côté.
- Dates : helpers de `_shared/training/weeks.ts`, jamais de `toISOString()` sur une date locale.
- Anthropic : uniquement via `_shared/anthropic.ts`.
- Aucune nouvelle dépendance Deno ou npm sans accord d'Alexis (dire le coût, puis attendre).

## Vérifier

`npm run check:functions` doit passer. Si une dépendance a changé, rafraîchir les lockfiles (voir le CLAUDE.md, section Commandes).

## Documenter

Mettre à jour dans le CLAUDE.md : la table des Edge Functions, la liste `requireModule` par module et la liste `verify_jwt`.

## Déployer

Seulement sur demande explicite d'Alexis :
`npx supabase functions deploy <nom> --project-ref $SUPABASE_PROJECT_REF --use-api`.
Ne jamais créer ni modifier de secret Supabase.
