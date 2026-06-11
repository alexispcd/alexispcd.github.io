# Le Cairn — Contexte projet

## Stack
- React 19, Vite 8, MUI 9, React Router v7
- PWA via vite-plugin-pwa
- Déployé sur GitHub Pages (statique)
- Supabase : auth + BDD + Edge Functions
- API Anthropic via Supabase Edge Functions uniquement (jamais côté client)

## Structure src/
- `apps/home/` — page d'accueil
- `apps/cotes-run/` — outil Côtes (ex Côtes.Run)
- `apps/training/` — outil Training (à créer)
- `apps/veille/` — outil Veille dev (à créer, futur)
- `components/AppCard.jsx` — carte outil réutilisable
- `styles/theme.js` — thème MUI dark, primary #5a9e78
- `lib/supabase.js` — client Supabase (à créer)

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

## Supabase — schéma BDD

profiles (id uuid, email text)

training_plans (
  id uuid,
  user_id uuid,
  generated_at timestamp,
  race_name text,
  race_date date,
  race_distance text,
  target_time text,
  weeks jsonb
)

watch_items (
  id uuid,
  user_id uuid,
  url text,
  title text,
  tags text[],
  read_at timestamp
)

---

## Specs Training — Génération de plan

### Contexte demandé à l'utilisateur avant génération
- Nom de la course
- Date de la course
- Distance (semi, 10km, marathon...)
- Objectif de temps
- Déjà couru cette course ? Si oui, temps précédents
- Remarques libres (blessure, contrainte particulière)

### Découpage hebdomadaire fixe
- Zone A : lundi ou mardi → séance course
- Zone B : mercredi, jeudi ou vendredi → séance course qualité (fractionné ou tempo)
- Zone C : samedi ou dimanche → sortie longue
- + 1 séance renfo/semaine (jour flexible, contenu détaillé généré par Claude)

### Renforcement musculaire
- Matériel disponible : tapis de sol uniquement (chaise possible mais à minimiser)
- Contenu détaillé : exercices + séries + temps de repos
- Orienté course à pied (gainage, fessiers, ischio, proprioception)

### Règles de gestion des séances sautées
- 1 séance sautée → adapter les séances restantes de la semaine courante
- 2 séances sautées → adapter fin de semaine courante + alléger semaine suivante (-15 à -20% volume, pas d'intensité haute)
- 3+ séances sautées → proposer une régénération du plan à partir de la semaine courante

### Philosophie du plan
- Basé sur les capacités réelles (données Coros : FC, allures, HRV, charge)
- Pas de copier-coller des séances passées — progressif et adapté à l'objectif
- 3 blocs : Construction → Intensification → Affûtage
- Calibrer les zones FC et allures cibles à partir de l'historique Coros

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
- Le Monde Informatique : https://www.lemondeinformatique.fr/flux-rss.xml
- Journal du Net : https://www.journaldunet.com/rss/
- ZDNet France : https://www.zdnet.fr/feeds/rss/actualites/
- The Hacker News : https://feeds.feedburner.com/TheHackersNews
- ANSSI : https://www.ssi.gouv.fr/feed/
- Krebs on Security : https://krebsonsecurity.com/feed/
- AWS Blog : https://aws.amazon.com/blogs/aws/feed/
- InfoQ Cloud : https://feed.infoq.com/cloud
- Anthropic Blog : https://www.anthropic.com/rss.xml
- MIT Technology Review AI : https://www.technologyreview.com/topic/artificial-intelligence/feed
- dev.to : https://dev.to/feed
- CSS Tricks : https://css-tricks.com/feed/
- Towards Data Science : https://towardsdatascience.com/feed
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
- Sync RSS automatique à l'ouverture
- Filtrage par thème (chips horizontaux)
- Statut lu / non lu
- Favoris
- Résumé à la demande via Claude (bouton sur chaque article)

### Fiche générée par Claude
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
- summarize-article : reçoit { url, title, content }, appelle Claude, retourne { summary, keyPoints, suggestedTags }

### Architecture
- Sync RSS côté client au chargement (fetch CORS via un proxy ou Edge Function)
- Résumé à la demande uniquement (pas automatique)
- Sauvegarde fiche en BDD après génération
