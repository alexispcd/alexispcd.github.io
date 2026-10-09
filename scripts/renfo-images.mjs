// Photos des exercices du module Renfo, depuis le dépôt public yuhonas/free-exercise-db
// (licence Unlicense) : exercises/<image>/0.jpg (départ) et 1.jpg (arrivée).
// Écrit public/renfo/<slug>-0.webp et <slug>-1.webp. Le nom suit le slug et non le
// dossier source, car plusieurs slugs partagent un même dossier.
// Lancement : node scripts/renfo-images.mjs (git et réseau requis).

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

const REPO = 'https://github.com/yuhonas/free-exercise-db.git'
const CATALOG = join('supabase', 'functions', '_shared', 'strength', 'catalog.ts')
const OUT_DIR = join('public', 'renfo')
const MAX_WIDTH = 480
const QUALITY = 70

// Le catalogue est en TypeScript : une entrée par ligne, lue par expression régulière.
const entries = readFileSync(CATALOG, 'utf8')
  .split('\n')
  .map((line) => ({
    slug: line.match(/\bslug: "([^"]+)"/)?.[1],
    image: line.match(/\bimage: "([^"]+)"/)?.[1],
  }))
  .filter((e) => e.slug && e.image)

const tmp = mkdtempSync(join(tmpdir(), 'free-exercise-db-'))
try {
  execFileSync('git', ['clone', '--depth', '1', REPO, tmp], { stdio: 'inherit' })
  mkdirSync(OUT_DIR, { recursive: true })
  for (const { slug, image } of entries) {
    for (const frame of [0, 1]) {
      await sharp(join(tmp, 'exercises', image, `${frame}.jpg`))
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toFile(join(OUT_DIR, `${slug}-${frame}.webp`))
    }
  }
  console.log(`${entries.length} exercices, ${entries.length * 2} images dans ${OUT_DIR}`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
