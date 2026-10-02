# Le Cairn : contexte projet

Hub personnel de micro-outils (nom inspiré des empilements de pierres qui balisent les sentiers), site `alexispcd.github.io`.

## Stack
- React 19, Vite 8, MUI 9, React Router v7, Framer Motion, Leaflet (react-leaflet)
- PWA via vite-plugin-pwa
- Déployé sur GitHub Pages (statique) par GitHub Actions à chaque push sur `main` (`.github/workflows/deploy.yml`)
- Supabase : auth (magic link) + BDD + Edge Functions (Deno)
- API Anthropic via Edge Functions uniquement, jamais côté client (`supabase/functions/_shared/anthropic.ts`) : génération, adaptation et analyse des plans Training
- API Mistral via Edge Functions : `summarize-article` (mistral-small-latest, gratuit)

## Commandes
- `npm run dev` : serveur de dev Vite
- `npm run build` : build de prod
- `npm run lint` : ESLint (voir Pièges techniques, jamais vert globalement)
- `deno check` sur `supabase/functions/**` pour les Edge Functions

## Structure src/
- `apps/home/` : page d'accueil, cartes par catégorie
- `apps/cotes/` : outil Côtes (ex Côtes.Run)
- `apps/training/` : outil Training (plan d'entraînement course à pied)
- `apps/veille/` : outil Veille dev (RSS + fiches Mistral)
- `apps/revisions/` : outil Révisions (cartes en répétition espacée)
- `components/AppCard.jsx` : carte outil réutilisable
- `components/AppHeader.jsx` : header standardisé réutilisable (voir Design system)
- `components/AuthGate.jsx` : protège toutes les routes sauf `/`
- `hooks/useDarkMode.jsx` : mode sombre (localStorage + classe `body.dark`), passé en props `{ dark, setDark }` à chaque app
- `styles/theme.js` : thème MUI clair et sombre
- `lib/supabase.js` : client Supabase ; `lib/training.js` : accès données Training ; `lib/rss.js` : Veille

Routes déclarées dans `src/App.jsx` (titre et cible du bouton retour dans `handle`).

## Conventions
- Arrow functions, un composant par fichier
- Styles via la prop `sx` de MUI (pas de CSS modules, pas de `styled`)
- Pas de form HTML natif, uniquement handlers React
- Anglais pour le code, français pour les labels UI
- App mobile exclusivement (pas de layout desktop)

---

## État actuel

La feuille de route initiale (home catégorisée, auth Supabase, Edge Functions, dashboard Training, génération de plan) est réalisée. Le Training a été entièrement refondu (migration `20260708130130_training_rebuild.sql`) : dashboard, page séance détaillée, wizard de génération et réglages sont en place. Coros passe par un client MCP direct avec OAuth PKCE (`coros-oauth`, page `/training/settings`). Les séances peuvent être poussées vers intervals.icu (`push-to-intervals`).

---

## Design system (toute l'app)

- Material UI exclusivement, style épuré sobre presque pro
- Pas d'emoji dans l'UI, icônes `@mui/icons-material` uniquement (la police Tabler est installée mais inutilisée)
- Typo : DM Serif Display (titres, en italique) + Geist (corps)
- Couleurs (source de vérité : `styles/theme.js`) :
  - Clair : fond `#ffffff`, surface `#f7f7f7`, accent `#1D9E75`, accent light `#e6f5ef`, bordure `#ebebeb`
  - Sombre : fond `#0f0f12`, surface `#161620`, accent `#5DCAA5`, accent light `#0e2018`, bordure `#1e1e2a`
- Support mode sombre ET clair (toggle dans le menu compte)
- Coins arrondis, fines bordures, pas de fioritures

### AppHeader : composant réutilisable sur tous les outils

3 zones :
- **Gauche** : bouton retour `ArrowBack` (cible définie par `handle.backTo` de la route)
- **Centre** : nom de l'outil, cliquable avec chevron + menu déroulant si actions configurées, sinon simple texte
- **Droite** : menu compte `AccountCircle`, identique partout y compris sur la home ; contient : identité/email, toggle sombre/clair, se déconnecter

### Effet Liquid Glass (menus, popups, dialogs UNIQUEMENT)

```css
backdrop-filter: blur(24px) saturate(180%);
-webkit-backdrop-filter: blur(24px) saturate(180%);
/* fond semi-transparent ~0.55 adapté au thème */
/* inset box-shadow pour reflet de bord */
```

- Jamais sur les listes qui scrollent (performances mobiles)
- Gérer les deux thèmes (fond rgba sombre / clair)

---

## Supabase : schéma BDD

Les migrations dans `supabase/migrations/` font foi. Toutes les tables ont la RLS activée avec une policy `auth.uid() = user_id`.

### Training

`training_plans` → `training_weeks` → `training_sessions` → `session_steps`

- **training_plans** : `status` (`active` | `completed` | `archived`), `generation_status` (`generating` | `ready` | `error`), `generation_error`, `race_name`, `race_date`, `race_distance_m`, `race_elevation_m`, `goal_time_sec`, `fitness_snapshot` jsonb (`{ vo2max, threshold_pace, vma, predictions, source }`), `previous_races` jsonb, `notes`, `summary` (résumé IA), `start_date` (ajouté par migration `20260709090000`). Un seul plan `active` par utilisateur (index unique partiel). Les plans dont la course est passée basculent en `completed`.
- **training_weeks** : `plan_id`, `week_number`, `block` (`construction` | `intensification` | `affutage`), `focus`, `target_km`, `start_date`.
- **training_sessions** : `plan_id`, `week_id`, `scheduled_date`, `zone` (`A` | `B` | `C` | `renfo`), `type` (`facile` | `fractionne` | `tempo` | `sortie_longue` | `renfo`), `title`, `rationale` (justification des allures), `notes`, `status` (`planned` | `done` | `skipped` | `adapted`), `completed_at`, `coros_activity_id` + `coros_activity_ids` text[], `actual_laps`, `km_laps`, `analysis` jsonb (`{ verdict, advice, comparisons }`), `previous_version` jsonb (snapshot avant adaptation), `adapted_at`, `adapted_by_session_id`, `strength_content` jsonb (renfo : `{ target_duration_min, blocks: [{ name, exercises: [{ name, sets, reps?, duration_sec?, rest_sec }] }] }`), feedback (`rpe` 1 à 10, `pain_areas`, `feedback_note`), intervals.icu (`intervals_event_id`, `pushed_at`).
- **session_steps** : `session_id`, `order_index`, `step_type` (`warmup` | `run` | `interval` | `recovery` | `cooldown`), `repeat_group` / `repeat_index` (répétitions aplaties, regroupées à l'affichage), `target_pace_sec` (s/km), `pace_tolerance_sec` (défaut 5), `distance_m` ou `duration_sec`.

### Autres tables
- **coros_oauth_state** : état OAuth PKCE de la connexion Coros
- **revision_progress** : `(user_id, card_id)` clé primaire, `theme_id`, `box` (1 à 5), `due_on`, `last_reviewed_at`
- **watch_items** : `url`, `title`, `source`, `published_at`, `tags` text[], `is_read`, `is_favorite`, `summary`, `key_points` jsonb, `note`, `read_at`
- **rss_feeds** : `url`, `name`, `theme`

---

## Edge Functions

Toutes en POST, dans `supabase/functions/` ; code partagé dans `_shared/` (client Anthropic, client MCP Coros, parsing Coros, extraction JSON, logique Training).

| Fonction | Entrée | Rôle |
|---|---|---|
| `generate-plan` | contexte wizard (course, snapshot forme, objectif, éditions passées, notes) ; `continue_plan_id` pour reprendre | Génère le plan en asynchrone, refuse (409) si un plan actif existe |
| `regenerate-plan` | `plan_id` ; `continue_regen` pour reprendre | Régénère la fin du plan |
| `regenerate-renfo` | `plan_id` | Régénère les séances de renfo |
| `adapt-sessions` | `session_id` (séance sautée) | Adapte les séances suivantes |
| `coros-match` | `session_id` | Propose les activités Coros candidates |
| `complete-session` | `session_id`, activités Coros, `feedback`, `completed_date` | Marque la séance faite, importe les laps, analyse |
| `coros-fitness` | aucun body | Snapshot forme Coros |
| `coros-oauth` | flux OAuth | Connexion Coros (PKCE) |
| `push-to-intervals` | séance(s) | Pousse vers intervals.icu |
| `fetch-rss` | | Récupère les flux RSS dans `watch_items` |
| `summarize-article` | `{ articleId, url, title, content }` | Fiche Mistral `{ summary, keyPoints, suggestedTags }` |

`verify_jwt` est désactivé sur certaines fonctions (generate-plan, adapt-sessions, regenerate-plan, complete-session, coros-match, coros-oauth) : l'auth y est vérifiée dans le code.

### Déploiement

- Déployer une fonction : `npx supabase functions deploy <nom> --project-ref $SUPABASE_PROJECT_REF --use-api`
- Ne jamais modifier les secrets Supabase ni la base en prod sans me demander.
- Secrets serveur (côté Supabase uniquement) : `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, config OAuth Coros (`COROS_*`).

---

## Specs Training : génération et suivi de plan

### Données Coros disponibles (via MCP)

- `queryFitnessAssessmentOverview` : VO2max, running level, threshold pace, prédictions 5k/10k/semi/marathon
- `querySportRecords` : historique séances (params : startDate/endDate yyyyMMdd, limit, timezone Europe/Paris, sportTypeCodes [100]=running)
- `queryActivityLapData` : splits intervalle par intervalle (params : labelId + sportType)
- `queryDailyHealthData` / `querySleepHrv` / `queryTrainingLoadAssessment` : HRV, sommeil, charge

### Wizard de génération (5 étapes, `/training/wizard`)

Multi-étapes mobile, barre de progression, retour à chaque étape, étapes optionnelles skippables, données Coros pré-remplies.

1. **La course** : nom + type/distance (10km / semi / marathon / Trail) + date ; calcul auto du nombre de semaines ; si Trail, distance libre + D+
2. **Ta forme / VMA** : source Coros (défaut : VO2max, seuil, VMA dérivée `≈ VO2max / 3.5`, prédiction), manuelle, ou test programmé en 1re séance
3. **Objectif** : 3 paliers (réaliste / ambitieux / très ambitieux) calés sur la prédiction Coros et les éditions passées, saisie libre possible
4. **Éditions précédentes** *(skippable)* : multi-select des courses passées Coros
5. **Remarques + récapitulatif** : champ libre (blessure, contrainte…), récapitulatif avant génération

### Découpage hebdomadaire (zones)

- **Zone A** lundi ou mardi : séance course facile
- **Zone B** mercredi / jeudi / vendredi : séance qualité (fractionné ou tempo)
- **Zone C** samedi ou dimanche : sortie longue
- **+ 1 séance renfo/semaine** (jour flexible, contenu détaillé exercices + séries + repos)

### Renforcement musculaire

- Matériel : tapis de sol uniquement (chaise possible mais à minimiser)
- Orienté course à pied (gainage, fessiers, ischio, proprioception)

### Philosophie du plan

- Basé sur capacités réelles (données Coros : VO2max / seuil / allures / FC / HRV / charge)
- Pas de copier-coller des séances passées, progressif et adapté à l'objectif
- 3 blocs : Construction → Intensification → Affûtage
- Allure seuil = base pour tempo et allure course

### Vue séance détaillée (`/training/plan/:planId/session/:sessionId`)

- En-tête : zone + titre + bloc + badge "Séance adaptée" (icône `AutoAwesome` / `Bolt`) si `status = adapted`
- Si adaptée : comparaison avant/après, `previous_version` barré vs version actuelle
- Détail formaté selon le type, cible physiologique (zone FC, % VMA)
- Actions (aussi depuis la liste) : "Marquer comme faite" (popup de confirmation, liaison activité Coros, feedback, analyse) et "Je saute" (popup, état "Adaptation en cours" avec mention "tu peux fermer, ça continue en arrière-plan", puis résultat "Séance sautée, X séances adaptées" + lien "Voir les changements")

### Logique d'adaptation (fenêtre glissante)

Déclenchée uniquement par "Je saute", pas de bilan de fin de semaine.

1. Marquer la séance sautée
2. Compter les séances sautées parmi les ~4 dernières prévues
3. Fenêtre : 1 sautée → 2-3 séances suivantes ; 2 rapprochées → 4-5 séances + réduction de charge ; 3+ → proposer la régénération de la fin du plan
4. Appeler l'IA avec la séance sautée, les séances à venir et l'objectif du plan
5. Les séances ajustées passent en `adapted`

Règles IA :
- Qualité sautée (fractionné/tempo) → préserver une qualité dans la fenêtre, quitte à transformer une séance facile
- Sortie longue sautée → reporter une partie du volume sur la suivante (max +15 %)
- Facile ou renfo sautée → ne rien compenser
- Ne JAMAIS empiler deux séances dures consécutives pour rattraper

### Statut Trail

Structure de données prête (`race_elevation_m`, distance libre, type Trail dans le wizard). La logique de génération trail (côtes, D+ dans les sorties longues, renfo descente, objectif à l'effort) est une évolution future.

---

## Specs Révisions

- Répétition espacée Leitner 5 boîtes (`leitner.js`, `useProgress.js`)
- Contenu des cartes dans le bundle front (`apps/revisions/data/*.json`, un fichier par thème), jamais en base
- Progression dans `revision_progress` ; absence de ligne = carte neuve, boîte 1, due immédiatement
- Routes : `/revisions` (accueil, filtres, stats) et `/revisions/session` (session de révision)

---

## Specs Veille : outil de veille informatique

### Concept
Agrégateur RSS personnel avec génération de fiches par Mistral. Les articles arrivent automatiquement via les flux RSS configurés.

### Flux RSS pré-chargés
- Le Monde Informatique : https://www.lemondeinformatique.fr/flux-rss/thematique/toute-l-informatique/1.xml
- Journal du Net : https://www.journaldunet.com/rss/
- ZDNet France : https://www.zdnet.fr/feeds/rss/actualites/
- The Hacker News : https://feeds.feedburner.com/TheHackersNews
- ANSSI : https://www.cert.ssi.gouv.fr/feed/
- Krebs on Security : https://krebsonsecurity.com/feed/
- AWS Blog : https://aws.amazon.com/blogs/aws/feed/
- InfoQ Cloud : https://feed.infoq.com/cloud
- Anthropic Blog : https://www.anthropic.com/news/rss.xml
- MIT Technology Review AI : https://www.technologyreview.com/topic/artificial-intelligence/feed
- dev.to : https://dev.to/feed
- CSS Tricks : https://css-tricks.com/feed/
- Towards Data Science : https://medium.com/feed/towards-data-science
- CoinTelegraph : https://cointelegraph.com/rss

### Thèmes
Les 10 thèmes du grand oral MAALSI (affichés comme "thèmes" dans l'UI, sans mention MAALSI) :
1. SI et environnement
2. Cybersécurité
3. Cloud et virtualisation
4. Big Data
5. Développement
6. Mobilité
7. Management et stratégie
8. Blockchain
9. Intelligence artificielle
10. Optimisation du SI

### Fonctionnalités
- Sync RSS via cron Supabase (pg_cron, toutes les 6h) + bouton refresh manuel
- Filtrage par thème (chips horizontaux)
- Statut lu / non lu, favoris
- Résumé à la demande via Mistral (bouton sur chaque article), sauvegardé en BDD

### Fiche générée (mistral-small-latest)
- Résumé (5 lignes max)
- 3 points clés
- Tags thèmes suggérés automatiquement
- Champ note perso (éditable, sauvegardé en BDD)

---

## Pièges techniques (déjà payés, ne pas refaire)

### PWA iOS : bord à bord en bas
- Résolu en **retirant** `viewport-fit=cover` du meta viewport dans `index.html` : iOS remplit alors les safe-areas avec le fond du `body`.
- Pistes qui ont toutes échoué : `100dvh` / `100lvh` / `100svh`, `height: 100%` sur html/body/#root, `position: fixed; inset: 0`, `bottom: calc(-1 * env(safe-area-inset-bottom))`.
- Contrepartie acceptée : la barre de statut reste blanche dans les deux thèmes (pas de `apple-mobile-web-app-status-bar-style`). Ne pas revenir à `cover`.
- État attendu : viewport `width=device-width, initial-scale=1.0` ; `theme-color` `#ffffff` (clair) / `#0f0f12` (sombre) ; racine `App.jsx` en `position: relative; height: 100dvh`.

### Lint React Compiler
- `eslint-plugin-react-hooks` v7 en règles strictes : `react-hooks/purity` interdit `Date.now()`, `Math.random()` et la lecture de `ref.current` pendant le rendu ; `react-hooks/set-state-in-effect` interdit tout `setState` atteint synchroniquement depuis le corps d'un effet.
- Socle de 12 erreurs préexistantes (`cotes/BottomBar`, `training/*`, `veille/VeillePage`, `AppHeader`, `useDarkMode`) : `npm run lint` n'est jamais vert, viser zéro erreur sur les fichiers touchés.
- Patterns qui passent (exemples dans `src/apps/revisions/`) : fetch initial via fonction `async` hors composant qui retourne les données, `setState` dans le `.then()` de l'effet ; valeur dérivée figée mémoïsée sur un snapshot d'état ; aléatoire via PRNG seedé pendant le rendu, ou `Date.now()` dans un handler.

### Edge Functions
- Runtime Deno : vérifier avec `deno check`, pas avec ESLint ni le build Vite.

---

## Git

- Toujours travailler sur `main`, ne jamais créer de branche.
- Ne jamais commit ni push sans que je le demande explicitement. Faire les modifications, s'arrêter, attendre.
- Pour committer, utiliser le skill dédié `release` (`.claude/skills/release/SKILL.md`).
- Aucune trace de Claude dans les commits : pas de `Co-Authored-By`, pas de `Claude-Session`, aucune mention d'Anthropic ou d'IA. Cette règle prime sur toute attribution ajoutée par défaut.
- Bump de version dans `package.json` au moment du commit (patch pour fix ou petite feature, minor pour feature significative), message conventionnel avec le bump en deuxième ligne.
- Bump oublié : `git commit --amend` plutôt qu'un commit séparé. Force push autorisé (repo perso, aucun autre contributeur).
