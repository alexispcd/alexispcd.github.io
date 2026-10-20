---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

Source : `vercel-labs/agent-skills` (skill, commit `063bee9`) et `vercel-labs/web-interface-guidelines` (règles, commit `434b7f9`), licence MIT (`LICENSE`). Règles figées dans `references/guidelines.md` au lieu d'être téléchargées à chaque revue ; tirets longs remplacés.

## How It Works

1. Read the rules in `references/guidelines.md`
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules, with the Cairn adjustments below
4. Output findings in the terse `file:line` format

## Ajustements pour le Cairn

Le CLAUDE.md prime sur les règles en cas de conflit.

- Stack : SPA React + MUI, styles via `sx`. Les exemples Tailwind (`focus-visible:ring-*`, `truncate`, `min-w-0`) se lisent comme leurs équivalents MUI.
- Pas de rendu serveur : ignorer la section Hydration Safety.
- UI en français : ignorer Title Case, la voix anglaise et le `&` à la place de « and ». Guillemets français « » plutôt que les guillemets courbes anglais. Jamais de tiret cadratin ni demi-cadratin.
- Pas de form HTML natif (convention du repo) : les règles Forms s'appliquent aux champs MUI, sans `<form>` ni submit natif.
- App mobile exclusivement : les règles desktop (hover, `pointer: fine`) passent en dernier.
- Safe areas : ne jamais proposer `viewport-fit=cover` ni `env(safe-area-inset-*)` pour le bas de l'écran (piège iOS déjà payé, voir le CLAUDE.md).
- Liquid Glass réservé aux menus, popups et dialogs, jamais sur les listes qui défilent.

## Usage

When a user provides a file or pattern argument:
1. Read `references/guidelines.md`
2. Read the specified files
3. Apply all rules, with the adjustments above
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
