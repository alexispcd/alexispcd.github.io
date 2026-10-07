// Vérifie les Edge Functions : deno check sur chaque fonction avec son deno.json,
// puis deno test sur supabase/functions. Sort en erreur si une étape échoue.
// Lancement : npm run check:functions (Deno 2 requis dans le PATH).
//
// --frozen : les deno.lock doivent être à jour. Le deno.lock racine suit aussi les
// dépendances de package.json : après un changement de dépendance npm, le rafraîchir
// avec `deno test --frozen=false --allow-all supabase/functions/`.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const FUNCTIONS_DIR = join('supabase', 'functions')

const run = (args) => {
  console.log(`\n$ deno ${args.join(' ')}`)
  const { status, error } = spawnSync('deno', args, { stdio: 'inherit' })
  if (error) console.error(`Impossible de lancer deno : ${error.message}`)
  return status === 0
}

const functions = readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .filter((name) => existsSync(join(FUNCTIONS_DIR, name, 'index.ts')))
  .sort()

const failures = []

for (const name of functions) {
  const dir = join(FUNCTIONS_DIR, name)
  const args = ['check', '--frozen']
  if (existsSync(join(dir, 'deno.json'))) args.push('--config', join(dir, 'deno.json'))
  args.push(join(dir, 'index.ts'))
  if (!run(args)) failures.push(`deno check ${name}`)
}

if (!run(['test', '--frozen', '--allow-all', FUNCTIONS_DIR])) failures.push('deno test')

if (failures.length > 0) {
  console.error(`\nÉchec : ${failures.join(', ')}`)
  process.exit(1)
}
console.log(`\nOK : ${functions.length} fonctions vérifiées, tests verts.`)
