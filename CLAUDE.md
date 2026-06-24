# Le Cairn — Contexte projet

## Stack
- React 19, Vite 8, MUI 9, React Router v7
- PWA via vite-plugin-pwa
- Déployé sur GitHub Pages (statique)
- Supabase : auth + BDD + Edge Functions
- API Anthropic via Supabase Edge Functions uniquement (jamais côté client) — utilisée pour generate-plan
- API Mistral via Supabase Edge Functions — utilisée pour summarize-article (mistral-small-latest, gratuit)

## Structure src/
- `apps/home/` — page d'accueil
- `apps/cotes/` — outil Côtes
- `apps/training/` — outil Training
- `apps/veille/` — outil Veille dev
- `components/AppCard.jsx` — carte outil réutilisable
- `components/AppHeader.jsx` — header standardisé réutilisable (voir Design system)
- `styles/theme.js` — thème MUI, accents verts #1D9E75 / #5DCAA5, support sombre + clair
- `lib/supabase.js` — client Supabase

## Conventions
- Arrow functions, un composant par fichier
- Pas de form HTML natif, uniquement handlers React
- Anglais pour le code, français pour les labels UI

---

## Feuille de route

### Étape 1 — Home catégorisée (à faire en premier)
- Renommer Côtes.Run → Côtes dans toute la codebase
- Restructurer Home.jsx avec catégories : Sport (Côtes + Training) et Dev (Veille)
- Ajouter Training et Veille comme cartes "coming soon"
- Ajouter bouton retour vers / dans Côtes

### Étape 2 — Auth Supabase
- Créer src/lib/supabase.js
- Composant AuthGate qui protège toutes les routes sauf /
- Login par magic link (email uniquement, usage perso)
- Variables d'env : VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

### Étape 3 — Supabase Edge Functions
- Fonction generate-plan : vérifie auth Supabase, appelle API Anthropic
- Fonction coros-data : récupère données Coros via MCP (mcpeu.coros.com/mcp)
- Clé Anthropic uniquement dans les secrets Supabase, jamais dans le client
- Clé Mistral (MISTRAL_API_KEY) dans les secrets Supabase — utilisée par summarize-article

### Étape 4 — Training dashboard
- Route /training
- Appel Edge Function coros-data au chargement
- Affichage : stats semaine, 5 dernières séances, semaine type du plan actif
- Bouton "Générer un plan"

### Étape 5 — Génération et gestion du plan
- Formulaire de contexte avant génération (voir specs ci-dessous)
- Appel Edge Function generate-plan avec données Coros + contexte utilisateur
- Sauvegarde en BDD Supabase table training_plans (jsonb)
- Affichage plan semaine par semaine, séance par séance

### Étape 6 — Veille dev (futur)
- Table watch_items en BDD
- À concevoir plus tard

---

## Design system (toute l'app)

- Material UI exclusivement, style épuré sobre presque pro
- Pas d'emoji dans l'UI — utiliser `@mui/icons-material`
- Palette sombre sobre, accents verts `#1D9E75` et `#5DCAA5`
- Support mode sombre ET clair (toggle dans le menu compte)
- Coins arrondis, fines bordures, pas de fioritures

### AppHeader — composant réutilisable sur tous les outils

3 zones :
- **Gauche** : bouton retour `ArrowBack` vers la home
- **Centre** : nom de l'outil — cliquable avec chevron + menu déroulant si actions configurées, sinon simple texte ; actions vides pour l'instant
- **Droite** : menu compte `AccountCircle` — identique partout y compris sur la home ; contient : identité/email, toggle sombre/clair, se déconnecter

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

## Supabase — schéma BDD

### Table training_plans

```sql
create table training_plans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  start_date date not null,
  race_name text,
  race_date date,
  race_distance text,          -- libre : "semi", "trail 23km"
  race_elevation int,          -- D+ mètres, null pour route
  target_time text,
  previous_races jsonb,        -- [{year, time, coros_label_id}]
  fitness_snapshot jsonb,      -- {vo2max, running_level, threshold_pace, vma_derived, predictions, source, captured_at}
  vma_source text,             -- "coros" | "manuelle" | "test"
  status text default 'active',-- "active" | "completed" | "archived"
  notes text
);
```

Un seul plan `active` à la fois. Les autres sont `completed` ou `archived` (consultables, non modifiables).

### Table training_sessions

```sql
create table training_sessions (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references training_plans on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  week_number int,
  block text,                  -- "construction" | "intensification" | "affutage"
  zone text,                   -- "A" | "B" | "C" | "renfo"
  type text,                   -- "facile" | "fractionné" | "tempo" | "sortie_longue" | "renfo"
  title text,
  details jsonb,               -- variable selon type (voir exemples ci-dessous)
  previous_details jsonb,      -- version originale avant adaptation (null si jamais adaptée)
  day_of_week text,            -- optionnel, rempli à la planification
  scheduled_date date,         -- optionnel, rempli quand fait/planifié
  status text default 'à_venir',-- "à_venir" | "faite" | "sautée" | "adaptée"
  completed_at timestamptz,
  adapted_at timestamptz,
  coros_label_id text          -- lien vers séance Coros réelle, à la complétion
);
```

Calcul des semaines : pas de table semaines. Semaine N = `start_date + 7*(N-1)`. `day_of_week` et `scheduled_date` NON fixés à la génération — remplis seulement quand l'utilisateur planifie ou valide la séance.

Exemples `details` jsonb :
- Fractionné : `{"warmup":"15min @ 6:20","reps":6,"distance":"1000m","pace":"4:10","recovery":"90s","cooldown":"10min"}`
- Renfo : `{"exercises":[{"name":"Gainage planche","sets":3,"duration":"45s","rest":"30s"}]}`

### RLS

```sql
alter table training_plans enable row level security;
alter table training_sessions enable row level security;
create policy "user voit ses plans" on training_plans for all using (auth.uid() = user_id);
create policy "user voit ses séances" on training_sessions for all using (auth.uid() = user_id);
grant select, insert, update, delete on training_plans to authenticated;
grant select, insert, update, delete on training_sessions to authenticated;
```

### Table watch_items

```sql
watch_items (
  id uuid, user_id uuid, url text, title text, source text,
  published_at timestamp, tags text[],
  is_read boolean default false, is_favorite boolean default false,
  summary text, key_points jsonb, note text, read_at timestamp
)
```

---

## Specs Training — Génération et suivi de plan

### Données Coros disponibles à la génération (via MCP)

- `queryFitnessAssessmentOverview` — VO2max, running level, threshold pace, prédictions 5k/10k/semi/marathon
- `querySportRecords` — historique séances (params : startDate/endDate yyyyMMdd, limit, timezone Europe/Paris, sportTypeCodes [100]=running)
- `queryActivityLapData` — splits intervalle par intervalle (params : labelId + sportType ; donne le détail des fractionnés)
- `queryDailyHealthData` / `querySleepHrv` / `queryTrainingLoadAssessment` — HRV, sommeil, charge

### Wizard de génération (5 étapes)

Multi-étapes mobile, barre de progression, retour à chaque étape, étapes optionnelles skippables, données Coros pré-remplies.

**Étape 1 — La course**
- Nom + type/distance (10km / semi / marathon / Trail) + date
- Calcul auto du nombre de semaines depuis aujourd'hui jusqu'à la date
- Si Trail : afficher champs distance libre + D+

**Étape 2 — Ta forme / VMA**
- Choix source : Coros (défaut, affiche VO2max / seuil / VMA dérivée / prédiction) ou manuelle ou test programmé (test placé en 1ère séance)
- VMA dérivée : `VMA ≈ VO2max / 3.5`

**Étape 3 — Objectif**
- 3 paliers : réaliste / ambitieux / très ambitieux calés sur prédiction Coros et éditions passées
- Saisie libre possible

**Étape 4 — Éditions précédentes** *(skippable)*
- Multi-select pour lier éditions passées via `coros_label_id`

**Étape 5 — Remarques + récapitulatif**
- Champ libre (blessure, contrainte…)
- Récapitulatif avant génération

### Découpage hebdomadaire (zones)

- **Zone A** lundi ou mardi → séance course facile
- **Zone B** mercredi / jeudi / vendredi → séance qualité (fractionné ou tempo)
- **Zone C** samedi ou dimanche → sortie longue
- **+ 1 séance renfo/semaine** (jour flexible, contenu détaillé exercices + séries + repos)

`day_of_week` et `scheduled_date` NON fixés à la génération — l'utilisateur raisonne en zones.

### Renforcement musculaire

- Matériel : tapis de sol uniquement (chaise possible mais à minimiser)
- Contenu détaillé : exercices + séries + temps de repos
- Orienté course à pied (gainage, fessiers, ischio, proprioception)

### Philosophie du plan

- Basé sur capacités réelles (données Coros : VO2max / seuil / allures / FC / HRV / charge)
- Pas de copier-coller des séances passées — progressif et adapté à l'objectif
- 3 blocs : Construction → Intensification → Affûtage
- Calibrer zones FC et allures cibles depuis le snapshot Coros (allure seuil = base pour tempo et allure course)

### Vue séance détaillée

- En-tête : zone (A/B/C/renfo) + titre + bloc + badge "Séance adaptée" (icône `AutoAwesome`/`Bolt`) si `status = "adaptée"`
- Si adaptée : comparaison avant/après — `previous_details` original barré vs `details` actuel
- Détail de la séance formaté selon le type
- Cible physiologique : zone FC, % VMA depuis snapshot Coros
- Actions : "Marquer comme faite" et "Je saute"

### Actions sur séance

Disponibles depuis la liste ET la vue détaillée.

**VALIDER**
- Popup de confirmation
- Statut → "faite" + liaison séance Coros (`coros_label_id`) en arrière-plan pour analyse post-séance

**SAUTER**
- Popup de confirmation
- État de chargement "Adaptation en cours" — mention : "tu peux fermer, ça continue en arrière-plan"
- Popup de résultat : "Séance sautée, X séances adaptées" + lien "Voir les changements"

### Logique d'adaptation (fenêtre glissante)

Mécanisme unique déclenché manuellement par "Je saute". Pas de bilan de fin de semaine.

1. Marquer la séance sautée
2. Compter les séances récemment sautées parmi les ~4 dernières prévues
3. Dimensionner la fenêtre :
   - 1 sautée → adapter 2-3 séances suivantes
   - 2 sautées rapprochées → fenêtre 4-5 séances + réduction charge globale
   - 3+ rapprochées → proposer régénération de la fin du plan
4. Appeler l'IA avec : séance sautée (zone, type, objectif) + séances à venir + objectif du plan
5. Séances ajustées passent en statut "adaptée"

**Règles IA dans le prompt d'adaptation :**
- Séance sautée = qualité (fractionné/tempo) → préserver une qualité dans la fenêtre quitte à transformer une séance facile
- Séance sautée = sortie longue → reporter une partie du volume sur la sortie longue suivante (max +15%)
- Séance sautée = facile ou renfo → ne rien compenser
- Ne JAMAIS empiler deux séances dures consécutives pour rattraper

### Edge Functions

- `generate-plan` : vérifie auth, reçoit contexte wizard + données Coros, appelle l'IA, retourne plan structuré (plan + séances), sauvegarde en BDD
- `adapt-sessions` : vérifie auth, reçoit séance sautée + séances à venir + objectif, appelle l'IA, retourne séances ajustées
- Modèle IA : à trancher (Anthropic payant ou Mistral gratuit comme pour la Veille)

### Statut Trail

Structure de données prête (`race_elevation`, `elevation` dans `details`, `race_distance` libre, type Trail dans le wizard). La logique de génération trail (séances en côtes, D+ dans sorties longues, renfo descente, objectif basé effort) est une **évolution future**. Premier focus : plan route Auray-Vannes semi.

---

## Contexte utilisateur
- Coros Pace 3, connecté via MCP EU (mcpeu.coros.com/mcp)
- Objectif actuel : Auray-Vannes 2026 (semi-marathon), déjà couru en 2024 et 2025
- Coureur régulier, pratique aussi tennis et aviron
- App mobile exclusivement (pas de layout desktop nécessaire)

---

## Specs Veille — Outil de veille informatique

### Concept
Agrégateur RSS personnel avec génération de fiches par Claude.
Les articles arrivent automatiquement via les flux RSS configurés.

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
- Statut lu / non lu
- Favoris
- Résumé à la demande via Mistral (bouton sur chaque article)

### Fiche générée par Mistral (mistral-small-latest)
- Résumé (5 lignes max)
- 3 points clés
- Tags thèmes suggérés automatiquement
- Champ note perso (éditable, sauvegardé en BDD)

### Supabase — tables
watch_items (
  id uuid,
  user_id uuid,
  url text,
  title text,
  source text,
  published_at timestamp,
  tags text[],
  is_read boolean default false,
  is_favorite boolean default false,
  summary text,
  key_points jsonb,
  note text,
  read_at timestamp
)

rss_feeds (
  id uuid,
  user_id uuid,
  url text,
  name text,
  theme text
)

### Edge Functions
- fetch-rss : récupère et parse les flux RSS, insère les nouveaux articles dans watch_items
- summarize-article : reçoit { url, title, content }, appelle Mistral (mistral-small-latest), retourne { summary, keyPoints, suggestedTags }

### Architecture
- Sync RSS côté client au chargement (fetch CORS via un proxy ou Edge Function)
- Résumé à la demande uniquement (pas automatique)
- Sauvegarde fiche en BDD après génération
