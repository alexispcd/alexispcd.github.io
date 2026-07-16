// Tests de la logique renfo (catalogue, estimateur, trim, validation,
// enrichissement, parité). Exécution : deno test _shared/training/renfo_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  bonusKindForWeek, detectBonusKind, EXERCISE_INDEX, EXERCISES,
} from "./exercises.ts"
import {
  enrichBlocks, estimateExerciseSeconds, estimateStrengthDuration,
  finalizeStrengthContent, trimToTarget,
} from "./strength.ts"
import { validateStrengthContent } from "./validate.ts"
import type { StrengthBlock } from "./types.ts"

// ── Helpers de fixture ────────────────────────────────────────────────────────
const ref = (slug: string) => {
  const e = EXERCISE_INDEX[slug]
  if (!e) throw new Error(`slug de test inconnu : ${slug}`)
  return {
    slug,
    sets: e.sets,
    ...(e.reps != null ? { reps: e.reps } : {}),
    ...(e.duration_sec != null ? { duration_sec: e.duration_sec } : {}),
    rest_sec: e.rest_sec,
  }
}
const block = (theme: string, slugs: string[]): StrengthBlock => ({ theme, exercises: slugs.map(ref) })

// Base valide semaine IMPAIRE (bonus proprio/pied).
const oddBase = (): StrengthBlock[] => [
  block("Échauffement", ["rotations_hanches", "chat_vache", "squats_air"]),
  block("Force", ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "hip_thrust_chaise"]),
  block("Gainage", ["planche", "planche_laterale", "dead_bug"]),
  block("Bonus", ["equilibre_unipodal", "montees_mollets_unipodal", "excentrique_mollet"]),
]
// Base valide semaine PAIRE (bonus haut du corps).
const evenBase = (): StrengthBlock[] => [
  block("Échauffement", ["rotations_hanches", "chat_vache", "squats_air"]),
  block("Force", ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "hip_thrust_chaise"]),
  block("Gainage", ["planche", "planche_laterale", "dead_bug"]),
  block("Bonus", ["pompes", "dips_chaise", "superman"]),
]
const errs = (content: unknown): string[] => {
  const e: string[] = []
  validateStrengthContent(content, "test", e)
  return e
}

// ── Catalogue ─────────────────────────────────────────────────────────────────
Deno.test("catalogue : ~40 exercices, slugs uniques, copenhague en 2 variantes", () => {
  assert(EXERCISES.length >= 38, `catalogue trop petit : ${EXERCISES.length}`)
  const slugs = EXERCISES.map((e) => e.slug)
  assertEquals(new Set(slugs).size, slugs.length, "slugs dupliqués")
  assert(EXERCISE_INDEX["copenhague_courte"], "copenhague courte manquante")
  assert(EXERCISE_INDEX["copenhague_longue"], "copenhague longue manquante")
  assertEquals(EXERCISE_INDEX["copenhague_courte"].equipment, "chair")
  assertEquals(EXERCISE_INDEX["copenhague_longue"].category, "gainage")
  // Cohérence mode / valeurs par défaut.
  for (const e of EXERCISES) {
    if (e.mode === "reps") assert(e.reps != null, `${e.slug} mode reps sans reps`)
    if (e.mode === "duration") assert(e.duration_sec != null, `${e.slug} mode duration sans duration_sec`)
  }
})

// ── Estimateur ────────────────────────────────────────────────────────────────
Deno.test("estimateur : reps ~3s/rep + repos inter-séries", () => {
  // 3 séries × 10 reps × 3s = 90s travail + 2 × 30s repos = 60s → 150s.
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 3, reps: 10, rest_sec: 30 }), 150)
})
Deno.test("estimateur : duration bilatéral vs repos", () => {
  // 3 × 40s = 120s + 2 × 20s = 40s → 160s.
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 3, duration_sec: 40, rest_sec: 20, unilateral: false }), 160)
})
Deno.test("estimateur : duration unilatéral compte les deux côtés", () => {
  // 2 × (30s × 2 côtés) = 120s + 1 × 20s = 20s → 140s.
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 2, duration_sec: 30, rest_sec: 20, unilateral: true }), 140)
})
Deno.test("estimateur : unilatéral résolu depuis le catalogue si absent", () => {
  const withFlag = estimateExerciseSeconds({ slug: "planche_laterale", sets: 3, duration_sec: 30, rest_sec: 30, unilateral: true })
  const fromCatalog = estimateExerciseSeconds({ slug: "planche_laterale", sets: 3, duration_sec: 30, rest_sec: 30 })
  assertEquals(fromCatalog, withFlag, "planche_laterale est unilatérale au catalogue")
})
Deno.test("estimateur : base complète dans la fenêtre 40-50 min", () => {
  assert(estimateStrengthDuration(oddBase()) >= 40)
  assert(estimateStrengthDuration(oddBase()) <= 50)
  assert(estimateStrengthDuration(evenBase()) >= 40)
  assert(estimateStrengthDuration(evenBase()) <= 50)
})

// ── Trim ──────────────────────────────────────────────────────────────────────
Deno.test("trim : 45 = base complète (4 blocs)", () => {
  const t = trimToTarget(oddBase(), 45)
  assertEquals(t.length, 4)
  assertEquals(t, oddBase(), "45 doit rendre la base inchangée")
})
Deno.test("trim : 40 réduit sans retirer le bloc bonus", () => {
  const t = trimToTarget(oddBase(), 40)
  assertEquals(t.length, 4, "le bloc bonus reste présent à 40")
  assert(estimateStrengthDuration(t) <= 40)
  for (const b of t) assert(b.exercises.length >= 1, "jamais de bloc vide")
})
Deno.test("trim : 30 retire le bloc bonus", () => {
  const t = trimToTarget(oddBase(), 30)
  assertEquals(t.length, 3, "le bloc bonus disparaît à 30")
  assert(estimateStrengthDuration(t) <= 30)
})
Deno.test("trim : idempotent (toujours recalculé depuis la base)", () => {
  const once = trimToTarget(oddBase(), 30)
  const twice = trimToTarget(oddBase(), 30)
  assertEquals(once, twice)
})
Deno.test("trim : premier exercice de chaque bloc préservé", () => {
  const base = oddBase()
  const t = trimToTarget(base, 30)
  t.forEach((b, i) => {
    if (i < base.length) assertEquals(b.exercises[0].slug, base[i].exercises[0].slug)
  })
})

// ── Enrichissement + finalize ────────────────────────────────────────────────
Deno.test("enrichBlocks : résout name/description/equipment et thème déterministe", () => {
  const e = enrichBlocks(oddBase())
  assertEquals(e[0].theme, "Échauffement")
  assertEquals(e[1].theme, "Force")
  assertEquals(e[2].theme, "Gainage")
  assertEquals(e[3].theme, "Proprioception et pied")
  const first = e[0].exercises[0]
  assertEquals(first.name, EXERCISE_INDEX["rotations_hanches"].name)
  assert(first.description && first.description.length > 0)
  assertEquals(first.equipment, "none")
  const bulgare = e[1].exercises.find((x) => x.slug === "squat_bulgare")!
  assertEquals(bulgare.equipment, "chair")
  assertEquals(bulgare.unilateral, true)
})
Deno.test("enrichBlocks : bonus haut du corps détecté", () => {
  const e = enrichBlocks(evenBase())
  assertEquals(e[3].theme, "Haut du corps")
})
Deno.test("finalize : base figée, blocks trim à 40, idempotent", () => {
  const fin = finalizeStrengthContent({ target_duration_min: 45, blocks: oddBase() })
  assertEquals(fin.target_duration_min, 40)
  assertEquals(fin.base_blocks!.length, 4)
  assert(estimateStrengthDuration(fin.blocks) <= 40)
  assert(fin.base_blocks![0].exercises[0].name, "base enrichie")
  // Re-finalize depuis le résultat : base et trim identiques.
  const fin2 = finalizeStrengthContent(fin)
  assertEquals(
    fin.blocks.map((b) => b.exercises.length),
    fin2.blocks.map((b) => b.exercises.length),
  )
  assertEquals(estimateStrengthDuration(fin.base_blocks), estimateStrengthDuration(fin2.base_blocks))
})

// ── Parité du bloc bonus ──────────────────────────────────────────────────────
Deno.test("parité : impaire = proprio/pied, paire = haut du corps", () => {
  assertEquals(bonusKindForWeek(1), "proprio_pied")
  assertEquals(bonusKindForWeek(3), "proprio_pied")
  assertEquals(bonusKindForWeek(2), "haut_corps")
  assertEquals(bonusKindForWeek(8), "haut_corps")
})
Deno.test("detectBonusKind : cohérence / mélange", () => {
  assertEquals(detectBonusKind(["proprioception", "pied_mollets"]), "proprio_pied")
  assertEquals(detectBonusKind(["haut_corps", "haut_corps"]), "haut_corps")
  assertEquals(detectBonusKind(["proprioception", "haut_corps"]), null)
})

// ── Validation ────────────────────────────────────────────────────────────────
Deno.test("validation : base valide → aucune erreur", () => {
  assertEquals(errs({ target_duration_min: 45, blocks: oddBase() }), [])
  assertEquals(errs({ target_duration_min: 45, blocks: evenBase() }), [])
})
Deno.test("validation : refuse un nombre de blocs != 4", () => {
  const b = oddBase().slice(0, 3)
  assert(errs({ blocks: b }).some((e) => e.includes("4 blocs")))
})
Deno.test("validation : slug hors catalogue", () => {
  const b = oddBase()
  b[0].exercises[0] = { slug: "exercice_invente", sets: 1, duration_sec: 40, rest_sec: 15 } as never
  assert(errs({ blocks: b }).some((e) => e.includes("slug inconnu")))
})
Deno.test("validation : mauvaise catégorie dans un bloc", () => {
  const b = oddBase()
  // Un exercice de gainage placé dans le bloc force.
  b[1].exercises[0] = ref("planche") as never
  assert(errs({ blocks: b }).some((e) => e.includes("interdite")))
})
Deno.test("validation : bornes sets / rest", () => {
  const b1 = oddBase(); b1[1].exercises[0].sets = 6
  assert(errs({ blocks: b1 }).some((e) => e.includes("sets")))
  const b2 = oddBase(); b2[1].exercises[0].rest_sec = 200
  assert(errs({ blocks: b2 }).some((e) => e.includes("rest_sec")))
})
Deno.test("validation : reps ET duration_sec ensemble", () => {
  const b = oddBase()
  b[1].exercises[0] = { slug: "pont_fessier", sets: 3, reps: 12, duration_sec: 30, rest_sec: 45 } as never
  assert(errs({ blocks: b }).some((e) => e.includes("reps") && e.includes("duration_sec")))
})
Deno.test("validation : bloc bonus mélangé refusé", () => {
  const b = oddBase()
  b[3].exercises = [ref("equilibre_unipodal"), ref("pompes")] as never
  assert(errs({ blocks: b }).some((e) => e.includes("bonus")))
})
Deno.test("validation : total d'exercices hors bornes", () => {
  const b = oddBase().map((bl) => ({ ...bl, exercises: bl.exercises.slice(0, 1) })) // 4 exos
  assert(errs({ blocks: b }).some((e) => e.includes("exercices au total")))
})
Deno.test("validation : durée de base hors fenêtre", () => {
  // Sets minimaux partout → base trop courte.
  const b = oddBase().map((bl) => ({ ...bl, exercises: bl.exercises.map((e) => ({ ...e, sets: 1 })) }))
  assert(errs({ blocks: b }).some((e) => e.includes("durée estimée")))
})

// ── Rétrocompatibilité ────────────────────────────────────────────────────────
Deno.test("rétrocompat : ancien contenu (name, sans slug) reste estimable et intact au trim", () => {
  const legacy = [
    { name: "Gainage", exercises: [
      { name: "Planche", sets: 3, duration_sec: 45, rest_sec: 30 },
      { name: "Gainage latéral", sets: 3, duration_sec: 30, rest_sec: 30 },
      { name: "Superman", sets: 3, reps: 12, rest_sec: 30 },
    ] },
  ] as never as StrengthBlock[]
  assert(estimateStrengthDuration(legacy) > 0)
  const t = trimToTarget(legacy, 40)
  // Pas de slug → pas de renommage, le champ name d'origine est préservé.
  assertEquals((t[0] as unknown as { name: string }).name, "Gainage")
  assertEquals(t[0].exercises[0].slug, undefined)
})
