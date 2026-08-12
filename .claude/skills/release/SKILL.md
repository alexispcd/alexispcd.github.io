---
name: release
description: Bump la version, commit et push le travail en cours. À utiliser quand l'utilisateur demande d'incrémenter la version puis committer/pusher (ex. "release", "incrémente et push"). Argument optionnel patch|minor|major (défaut patch).
---

# release — bump version + commit + push

Workflow de release du Cairn. Déclenché manuellement par l'utilisateur.

## Étapes

1. **Vérifier l'état** : `git status --short` pour voir les fichiers modifiés à committer.
2. **Bump la version** dans `package.json` :
   - `patch` (défaut) : 0.8.17 → 0.8.18
   - `minor` : 0.8.17 → 0.9.0
   - `major` : 0.8.17 → 1.0.0
3. **Commit** : stage les fichiers pertinents + `package.json`. Message de commit conventionnel (`fix(scope):`, `feat(scope):`, `chore:`…) décrivant le vrai changement, avec le bump en deuxième ligne :
   ```
   fix(cotes): description du changement

   bump version X.Y.Z → X.Y.Z+1
   ```
4. **Push** : `git push`.
5. Reporter le hash court et le message du commit.

## Règles importantes

- **NE PAS mentionner Claude** dans le message de commit : pas de trailer `Co-Authored-By`, pas de `Claude-Session`. C'est une préférence explicite de l'utilisateur pour ce repo.
- Repo perso GitHub Pages : le force push est autorisé si besoin d'amender un commit déjà poussé.
- Si le working tree est vide (rien à committer), le signaler et ne rien faire.
