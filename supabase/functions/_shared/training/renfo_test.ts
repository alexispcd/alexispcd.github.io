// Tests de la logique renfo (catalogue, estimateur, trim, validation à trois
// niveaux, enrichissement, parité). Exécution : deno test renfo_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import {
  bonusKindForWeek, detectBonusKind, EXERCISE_INDEX, EXERCISES,
} from "./exercises.ts"
import {
  baseDurationHint, enrichBlocks, estimateExerciseSeconds, estimateStrengthDuration,
  finalDurationWarning, finalizeStrengthContent, MANDATORY_CALF_SLUG,
  REST_BETWEEN_EXERCISES_SEC, REST_BETWEEN_ROUNDS_SEC, trimToTarget,
  withMandatoryCalf, workSeconds,
} from "./strength.ts"
import { validateStrengthContent } from "./validate.ts"
import type { StrengthBlock } from "./types.ts"

// ── Helpers de fixture ────────────────────────────────────────────────────────
// Format circuit : l'exercice ne porte que sa charge, le bloc porte ses tours.
const ref = (slug: string) => {
  const e = EXERCISE_INDEX[slug]
  if (!e) throw new Error(`slug de test inconnu : ${slug}`)
  return {
    slug,
    ...(e.reps != null ? { reps: e.reps } : {}),
    ...(e.duration_sec != null ? { duration_sec: e.duration_sec } : {}),
  }
}
const block = (theme: string, rounds: number, slugs: string[]): StrengthBlock =>
  ({ theme, rounds, exercises: slugs.map(ref) })

// Blocs UNIFORMES synthétiques pour tester l'estimateur : n exercices de 45 s de
// travail (bilatéraux), sur `rounds` tours, répétés sur 4 blocs. C'est le socle
// des repères de contrôle de durée.
const work45 = (i: number) => ({ slug: `x${i}`, duration_sec: 45, unilateral: false })
const uniformBlocks = (rounds: number, nPerBlock: number): StrengthBlock[] =>
  Array.from({ length: 4 }, () => ({
    theme: "T", rounds, exercises: Array.from({ length: nPerBlock }, (_, i) => work45(i)),
  }))

// Base valide semaine IMPAIRE (bonus proprio/pied).
const oddBase = (): StrengthBlock[] => [
  block("Échauffement", 2, ["rotations_hanches", "chat_vache", "squats_air"]),
  block("Force", 3, ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "fente_arriere"]),
  block("Gainage", 3, ["planche", "planche_laterale", "dead_bug"]),
  block("Bonus", 2, ["corde_imaginaire", "montees_mollets_unipodal", "sauts_unipodaux"]),
]
// Base valide semaine PAIRE (bonus haut du corps).
const evenBase = (): StrengthBlock[] => [
  block("Échauffement", 2, ["rotations_hanches", "chat_vache", "squats_air"]),
  block("Force", 3, ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "fente_arriere"]),
  block("Gainage", 3, ["planche", "planche_laterale", "dead_bug"]),
  block("Bonus", 2, ["pompes", "dips_chaise", "superman"]),
]
const errs = (content: unknown): string[] => {
  const e: string[] = []
  validateStrengthContent(content, "test", e)
  return e
}

// ── Catalogue ─────────────────────────────────────────────────────────────────
Deno.test("catalogue : 46 exercices, un seul champ de référence chacun", () => {
  assertEquals(EXERCISES.length, 46, `catalogue : ${EXERCISES.length} exercices`)
  const slugs = EXERCISES.map((e) => e.slug)
  assertEquals(new Set(slugs).size, slugs.length, "slugs dupliqués")
  for (const e of EXERCISES) {
    const hasReps = e.ref_reps != null
    const hasDur = e.ref_duration_sec != null
    assert(hasReps !== hasDur, `${e.slug} : exactement un de ref_reps / ref_duration_sec attendu`)
    if (e.mode === "reps") assert(hasReps, `${e.slug} mode reps → ref_reps attendu`)
    if (e.mode === "duration") assert(hasDur, `${e.slug} mode duration → ref_duration_sec attendu`)
  }
  assert(EXERCISE_INDEX["copenhague_courte"], "copenhague courte manquante")
  assert(EXERCISE_INDEX["copenhague_longue"], "copenhague longue manquante")
})

// ── Estimateur circuit ────────────────────────────────────────────────────────
Deno.test("nouveaux temps de repos : 15 s inter-exercices, 20 s inter-tours", () => {
  assertEquals(REST_BETWEEN_EXERCISES_SEC, 15)
  assertEquals(REST_BETWEEN_ROUNDS_SEC, 20)
})
Deno.test("workSeconds : reps ~3s/rep, doublé si unilatéral", () => {
  assertEquals(workSeconds({ slug: "x", reps: 10, unilateral: false }), 30)
  assertEquals(workSeconds({ slug: "x", reps: 10, unilateral: true }), 60)
  assertEquals(workSeconds({ slug: "x", duration_sec: 40, unilateral: false }), 40)
  assertEquals(workSeconds({ slug: "x", duration_sec: 40, unilateral: true }), 80)
})
Deno.test("workSeconds : unilatéral résolu depuis le catalogue si absent", () => {
  assertEquals(workSeconds({ slug: "planche_laterale", duration_sec: 30 }), 60)
  assertEquals(workSeconds({ slug: "montees_mollets_unipodal", reps: 12 }), 72)
})
Deno.test("estimateur circuit : rounds × (travail + repos inter-exos) + repos inter-tours", () => {
  // 2 exercices bilatéraux de 30 s, 3 tours :
  // perRound = 30 + 30 + 15 = 75 ; bloc = 3 × 75 + 2 × 20 = 265 s → 4 min.
  const b: StrengthBlock[] = [{
    theme: "T", rounds: 3,
    exercises: [{ slug: "planche", duration_sec: 30 }, { slug: "hollow_hold", duration_sec: 30 }],
  }]
  assertEquals(estimateStrengthDuration(b), 4)
})
Deno.test("estimateur circuit : repos de 20 s entre deux blocs", () => {
  const one: StrengthBlock[] = [{ theme: "A", rounds: 2, exercises: [{ slug: "planche", duration_sec: 60 }] }]
  const two = [...one, { theme: "B", rounds: 2, exercises: [{ slug: "planche", duration_sec: 60 }] }]
  // Chaque bloc = 2 × 60 + 20 = 140 s ; deux blocs = 280 + 20 = 300 s.
  assertEquals(estimateStrengthDuration(one), 2)
  assertEquals(estimateStrengthDuration(two), 5)
})

// ── Repères de contrôle de durée (uniformes, ~45 s de travail par exercice) ────
Deno.test("repères : l'estimateur redonne les cinq durées attendues", () => {
  assertEquals(estimateStrengthDuration(uniformBlocks(2, 5)), 40) // cible atteinte
  assertEquals(estimateStrengthDuration(uniformBlocks(2, 4)), 32)
  assertEquals(estimateStrengthDuration(uniformBlocks(3, 3)), 37)
  assertEquals(estimateStrengthDuration(uniformBlocks(3, 4)), 49)
  assertEquals(estimateStrengthDuration(uniformBlocks(3, 5)), 61) // hors bande, retry
})

// ── Niveau 2 (durée souple) : indice de retry ─────────────────────────────────
Deno.test("niveau 2 : une base à 61 min déclenche un retry (indice non nul)", () => {
  const hint = baseDurationHint(uniformBlocks(3, 5), "renfo")
  assert(hint != null, "un indice de retry est attendu à 61 min")
  assert(hint!.includes("61"), `l'indice doit chiffrer l'écart : ${hint}`)
  assert(hint!.includes("40"), `l'indice doit rappeler la cible : ${hint}`)
})
Deno.test("niveau 2 : une base à 49 min ne déclenche pas de retry", () => {
  assertEquals(baseDurationHint(uniformBlocks(3, 4), "renfo"), null)
})
Deno.test("niveau 2 : la base modèle des fixtures reste dans la bande souple 32-58", () => {
  for (const base of [oddBase(), evenBase()]) {
    assertEquals(baseDurationHint(base, "renfo"), null, `base ${estimateStrengthDuration(base)} min hors bande souple`)
  }
})

// ── Niveaux 2 + 3 + règle de sortie : trim et acceptation ─────────────────────
Deno.test("une base à 49 min ressort trimmée entre 38 et 44 min", () => {
  const fin = finalizeStrengthContent({ blocks: uniformBlocks(3, 4) })
  const est = estimateStrengthDuration(fin.blocks)
  assert(est >= 38 && est <= 44, `séance finale à ${est} min hors bande`)
  assertEquals(finalDurationWarning(fin), null, "aucun avertissement de niveau 3 attendu")
})
Deno.test("règle de sortie : si le retry échoue (base à 61 min), la séance trimmée est acceptée", () => {
  const stillLong = uniformBlocks(3, 5) // hypothèse : le retry n'a rien amélioré
  assert(baseDurationHint(stillLong, "renfo") != null, "niveau 2 aurait déclenché un retry")
  // Le code ne rejette pas : il finalise (trim) et garde la séance.
  const fin = finalizeStrengthContent({ blocks: stillLong })
  const est = estimateStrengthDuration(fin.blocks)
  assert(est >= 38 && est <= 44, `séance trimmée à ${est} min hors bande, elle doit rester jouable`)
})

// ── Trim ──────────────────────────────────────────────────────────────────────
Deno.test("trim : cible large = base complète (4 blocs)", () => {
  const t = trimToTarget(oddBase(), 90)
  assertEquals(t.length, 4)
  assertEquals(t, oddBase(), "une cible non contraignante rend la base inchangée")
})
Deno.test("trim : 40 réduit sans retirer le bloc bonus", () => {
  const t = trimToTarget(withMandatoryCalf(oddBase()), 40)
  assertEquals(t.length, 4, "le bloc bonus reste présent à 40")
  assert(estimateStrengthDuration(t) <= 40)
})
Deno.test("trim : 30 retire le bloc bonus", () => {
  const t = trimToTarget(oddBase(), 30)
  assertEquals(t.length, 3, "le bloc bonus disparaît à 30")
  assert(estimateStrengthDuration(t) <= 30)
})
Deno.test("trim : plancher à 2 exercices par bloc", () => {
  const t = trimToTarget(oddBase(), 5)
  for (const b of t) {
    assert(b.exercises.length >= 2, `bloc "${b.theme}" tombé à ${b.exercises.length} exercice(s)`)
  }
})
Deno.test("trim : réduction des tours une fois les blocs au plancher", () => {
  const base = oddBase()
  const t = trimToTarget(base, 5)
  for (const b of t) assertEquals(b.exercises.length, 2)
  for (const b of t) assertEquals(b.rounds, 2, "plancher à 2 tours")
  assert(base.some((b) => b.rounds === 3), "la base doit contenir un bloc à 3 tours")
})
Deno.test("trim : idempotent (toujours recalculé depuis la base)", () => {
  assertEquals(trimToTarget(oddBase(), 30), trimToTarget(oddBase(), 30))
  assertEquals(trimToTarget(oddBase(), 40), trimToTarget(oddBase(), 40))
})
Deno.test("trim : le mollet excentrique survit à tous les paliers", () => {
  const base = finalizeStrengthContent({ blocks: oddBase() }).base_blocks!
  for (const target of [45, 40, 30, 20, 5]) {
    const t = trimToTarget(base, target)
    const found = t.flatMap((b) => b.exercises).filter((e) => e.slug === MANDATORY_CALF_SLUG)
    assertEquals(found.length, 1, `mollet perdu au palier ${target} min`)
  }
  assert(trimToTarget(base, 40)[1].exercises.some((e) => e.slug === MANDATORY_CALF_SLUG))
})
Deno.test("trim : mord avant le mollet, qui reste en dernière position", () => {
  const base = finalizeStrengthContent({ blocks: oddBase() }).base_blocks!
  const others = (b: StrengthBlock) => b.exercises.map((e) => e.slug).filter((s) => s !== MANDATORY_CALF_SLUG)
  const before = others(base[1])
  for (const target of [40, 30, 20]) {
    const force = trimToTarget(base, target)[1]
    assertEquals(force.exercises.at(-1)!.slug, MANDATORY_CALF_SLUG, `palier ${target}`)
    const after = others(force)
    assertEquals(after, before.slice(0, after.length), `palier ${target}`)
  }
})
Deno.test("trim : premier exercice de chaque bloc préservé", () => {
  const base = oddBase()
  const t = trimToTarget(base, 30)
  t.forEach((b, i) => {
    if (i < base.length) assertEquals(b.exercises[0].slug, base[i].exercises[0].slug)
  })
})
Deno.test("trim : la base n'est jamais mutée", () => {
  const base = oddBase()
  const before = JSON.stringify(base)
  trimToTarget(base, 20)
  assertEquals(JSON.stringify(base), before)
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

// ── Mollet excentrique obligatoire ────────────────────────────────────────────
Deno.test("mollet : injecté en dernière position du bloc Force", () => {
  const base = oddBase()
  const forceLen = base[1].exercises.length
  const out = withMandatoryCalf(base)
  assertEquals(out[1].exercises.length, forceLen + 1)
  assertEquals(out[1].exercises.at(-1)!.slug, MANDATORY_CALF_SLUG)
  assertEquals(out[1].exercises.at(-1)!.reps, 10)
  assertEquals(out[1].theme, "Force")
  assertEquals(out[0], base[0])
  assertEquals(out[2], base[2])
  assertEquals(out[3], base[3])
})
Deno.test("mollet : jamais dupliqué, où qu'il se trouve déjà", () => {
  const inForce = oddBase()
  inForce[1].exercises.push({ slug: MANDATORY_CALF_SLUG, reps: 12 })
  assertEquals(withMandatoryCalf(inForce), inForce)

  const inBonus = oddBase()
  inBonus[3].exercises.push({ slug: MANDATORY_CALF_SLUG, reps: 12 })
  const out = withMandatoryCalf(inBonus)
  assertEquals(out[1].exercises.length, oddBase()[1].exercises.length, "pas d'ajout au bloc Force")
  const count = out.flatMap((b) => b.exercises).filter((e) => e.slug === MANDATORY_CALF_SLUG).length
  assertEquals(count, 1)
})
Deno.test("mollet : injection idempotente et présente après finalize", () => {
  const fin = finalizeStrengthContent({ target_duration_min: 45, blocks: oddBase() })
  const inBase = fin.base_blocks!.flatMap((b) => b.exercises).filter((e) => e.slug === MANDATORY_CALF_SLUG)
  assertEquals(inBase.length, 1, "présent une seule fois dans la base")
  assertEquals(inBase[0].name, EXERCISE_INDEX[MANDATORY_CALF_SLUG].name)
  assertEquals(inBase[0].unilateral, true)
  const fin2 = finalizeStrengthContent(fin)
  const again = fin2.base_blocks!.flatMap((b) => b.exercises).filter((e) => e.slug === MANDATORY_CALF_SLUG)
  assertEquals(again.length, 1)
})
Deno.test("finalize : base figée, blocks trim à 40, idempotent", () => {
  const fin = finalizeStrengthContent({ target_duration_min: 45, blocks: oddBase() })
  assertEquals(fin.target_duration_min, 40)
  assertEquals(fin.base_blocks!.length, 4)
  assert(estimateStrengthDuration(fin.blocks) <= 40)
  assert(fin.base_blocks![0].exercises[0].name, "base enrichie")
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

// ── Validation de structure (niveau 1, DUR) ───────────────────────────────────
Deno.test("validation : base valide → aucune erreur", () => {
  assertEquals(errs({ target_duration_min: 45, blocks: oddBase() }), [])
  assertEquals(errs({ target_duration_min: 45, blocks: evenBase() }), [])
})
Deno.test("validation niveau 1 : refuse un nombre de blocs != 4", () => {
  const b = oddBase().slice(0, 3)
  assert(errs({ blocks: b }).some((e) => e.includes("4 blocs")))
})
Deno.test("validation niveau 1 : slug hors catalogue", () => {
  const b = oddBase()
  b[0].exercises[0] = { slug: "exercice_invente", duration_sec: 40 } as never
  assert(errs({ blocks: b }).some((e) => e.includes("slug inconnu")))
})
Deno.test("validation : mauvaise catégorie dans un bloc", () => {
  const b = oddBase()
  b[1].exercises[0] = ref("planche") as never
  assert(errs({ blocks: b }).some((e) => e.includes("interdite")))
})
Deno.test("validation : rounds obligatoire, à 2 ou 3", () => {
  for (const bad of [undefined, 1, 4, 2.5, "3"]) {
    const b = oddBase()
    b[1].rounds = bad as never
    assert(errs({ blocks: b }).some((e) => e.includes("rounds")), `rounds=${bad} devrait être refusé`)
  }
})
Deno.test("validation : sets et rest_sec ne sont plus contrôlés", () => {
  const b = oddBase()
  b[1].exercises[0] = { slug: "pont_fessier", reps: 15, sets: 99, rest_sec: 999 } as never
  const e = errs({ blocks: b })
  assert(!e.some((x) => x.includes("sets") || x.includes("rest_sec")), e.join(" / "))
})
Deno.test("validation : reps ET duration_sec ensemble", () => {
  const b = oddBase()
  b[1].exercises[0] = { slug: "pont_fessier", reps: 12, duration_sec: 30 } as never
  assert(errs({ blocks: b }).some((e) => e.includes("reps") && e.includes("duration_sec")))
})
Deno.test("validation : bloc bonus mélangé refusé", () => {
  const b = oddBase()
  b[3].exercises = [ref("corde_imaginaire"), ref("pompes"), ref("dips_chaise")] as never
  assert(errs({ blocks: b }).some((e) => e.includes("bonus")))
})
Deno.test("validation niveau 1 : total d'exercices projeté hors bornes", () => {
  const b = oddBase().map((bl) => ({ ...bl, exercises: bl.exercises.slice(0, 1) })) // 4 blocs à 1 exo
  assert(errs({ blocks: b }).some((e) => e.includes("exercices au total")))
})
Deno.test("validation niveau 1 : bloc Force projeté à 6 (mollet inclus) refusé", () => {
  // 5 exercices émis dans le bloc Force → +1 mollet = 6 > 5 par bloc.
  const b = oddBase()
  b[1] = block("Force", 3, ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "fente_arriere", "hip_thrust_chaise"])
  assert(errs({ blocks: b }).some((e) => e.includes("par bloc")), "Force à 6 exercices projetés doit être refusé")
})
Deno.test("validation : la durée n'est PAS un motif de rejet (niveau 1)", () => {
  // Base structurellement valide mais longue (Force à 4, autres à 5, 3 tours).
  const b: StrengthBlock[] = [
    block("Échauffement", 3, ["rotations_hanches", "chat_vache", "squats_air", "fentes_marchees", "balancements_jambe"]),
    block("Force", 3, ["pont_fessier", "squat_bulgare", "souleve_terre_unipodal", "fente_arriere"]),
    block("Gainage", 3, ["planche", "planche_laterale", "dead_bug", "hollow_hold", "bird_dog"]),
    block("Bonus", 3, ["corde_imaginaire", "montees_mollets_unipodal", "sauts_unipodaux", "marche_pointes", "equilibre_reach"]),
  ]
  assertEquals(errs({ blocks: b }), [], "aucune erreur de structure : la durée est traitée en soft")
  assert(baseDurationHint(b, "renfo") != null, "mais la durée déclenche bien un indice de retry")
})

// ── Rétrocompatibilité (plans générés avant le format circuit) ───────────────
const legacyBlocks = (): StrengthBlock[] => ([
  { name: "Gainage", exercises: [
    { name: "Planche", sets: 3, duration_sec: 45, rest_sec: 30 },
    { name: "Gainage latéral", sets: 3, duration_sec: 30, rest_sec: 30 },
    { name: "Superman", sets: 3, reps: 12, rest_sec: 30 },
  ] },
] as never as StrengthBlock[])

Deno.test("rétrocompat : estimateur en séries pour un bloc sans rounds", () => {
  // 3×45 + 2×30 = 195 ; 3×30 + 2×30 = 150 ; 3×(12×3) + 2×30 = 168.
  // + 2 repos inter-exercices de 15 s = 543 s → 9 min.
  assertEquals(estimateStrengthDuration(legacyBlocks()), 9)
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 3, reps: 10, rest_sec: 30 }), 150)
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 1, reps: 10, rest_sec: 0, unilateral: true }), 30)
  assertEquals(estimateExerciseSeconds({ slug: "x", sets: 1, duration_sec: 30, rest_sec: 0, unilateral: true }), 60)
})
Deno.test("rétrocompat : ancien contenu intact au trim et à l'enrichissement", () => {
  const t = trimToTarget(legacyBlocks(), 40)
  assertEquals((t[0] as unknown as { name: string }).name, "Gainage")
  assertEquals(t[0].exercises[0].slug, undefined)
  assertEquals(t[0].rounds, undefined, "pas de rounds ajouté rétroactivement")

  const withSlugs = [{
    theme: "Gainage",
    exercises: [{ slug: "planche", sets: 3, duration_sec: 45, rest_sec: 30 }],
  }] as StrengthBlock[]
  const e = enrichBlocks(withSlugs)
  assertEquals(e[0].rounds, undefined)
  assertEquals(e[0].exercises[0].sets, 3)
  assertEquals(e[0].exercises[0].rest_sec, 30)
  assertEquals(e[0].exercises[0].name, EXERCISE_INDEX["planche"].name)
})
Deno.test("enrichBlocks : un bloc circuit ne porte ni sets ni rest_sec", () => {
  const e = enrichBlocks(oddBase())
  assertEquals(e[1].rounds, 3)
  for (const ex of e.flatMap((b) => b.exercises)) {
    assertEquals(ex.sets, undefined, `${ex.slug} porte encore sets`)
    assertEquals(ex.rest_sec, undefined, `${ex.slug} porte encore rest_sec`)
  }
})
