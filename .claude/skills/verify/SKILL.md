---
name: verify
description: Lancer localement les mêmes vérifications que la CI du Cairn (lint, tests, build, Edge Functions) avant de rendre la main ou de committer. À utiliser à la fin de toute modification de code.
---

# verify : la CI en local

Miroir de `.github/workflows/ci.yml`. Lancer depuis la racine du repo, dans cet ordre :

1. `npm run lint` : 0 erreur, 0 warning. Ne pas assouplir `eslint.config.js`. Un `eslint-disable-next-line` ne se justifie que si la correction changerait le comportement, avec la règle et la raison en commentaire.
2. `npm test`
3. `npm run build`. Sans `VITE_SUPABASE_URL` ni `VITE_SUPABASE_ANON_KEY` dans l'environnement, le build peut passer avec un client non configuré : le signaler, ce n'est pas un échec.
4. `npm run check:functions` (Deno 2 requis). À lancer si `supabase/functions/` ou une dépendance a changé ; sinon le dire et le sauter.

## Compte rendu

- Tout est vert : le dire en une ligne, avec les étapes lancées.
- Un échec : donner la sortie utile (fichier, ligne, message), corriger si c'est dans le périmètre de la modification, puis relancer toute la suite. Ne jamais annoncer que c'est vert sans l'avoir vu.
- Échec hors du périmètre : le signaler sans corriger.
- Ne jamais désactiver ni sauter un test pour obtenir du vert.
