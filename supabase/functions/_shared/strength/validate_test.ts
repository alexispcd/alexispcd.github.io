// Tests de la validation du contenu d'une séance Renfo. Exécution : deno test validate_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import { availableExercises, EXERCISE_INDEX } from "./catalog.ts"
import { effectiveTrisetRules, lockedSlugs, type SessionKind, TRISETS_BY_KIND } from "./rules.ts"
import { type ValidationContext, validateSessionContent } from "./validate.ts"

const BANDS = [10, 15, 20, 30, 40]
const ctxOf = (kind: SessionKind): ValidationContext => ({ kind, equipment: ["chair", "bar"], bandsKg: BANDS })

/** Dosage valide d'un exercice selon son mode, bande de 20 kg s'il en utilise une. */
const d = (slug: string) => {
  const ex = EXERCISE_INDEX[slug]
  return {
    slug,
    ...(ex.mode === "reps" ? { reps: 10 } : { duration_sec: 30 }),
    ...(ex.equipment.includes("band") ? { band_kg: 20 } : {}),
  }
}

interface Spec {
  warmup: string[]
  trisets: [string, string, string][]
  cooldown: string[]
}

/** Séance au format trisets pour un type : focus de TRISETS_BY_KIND à chaque position. */
const build = (kind: SessionKind, spec: Spec) => ({
  title: "Séance",
  blocks: [
    { type: "warmup", items: spec.warmup.map(d) },
    ...spec.trisets.map(([a, b, c], i) => ({
      type: "superset", focus: TRISETS_BY_KIND[kind][i], rounds: 3, rest_sec: 75, a: d(a), b: d(b), c: d(c),
    })),
    { type: "cooldown", items: spec.cooldown.map(d) },
  ],
})

// Une séance valide par type. Barre à une seule hauteur (high) quand elle sert.
const SPECS: Record<SessionKind, Spec> = {
  full: {
    warmup: ["cercles_hanche", "ecartes_elastique"],
    trisets: [
      ["squat_bulgare", "sdt_roumain_elastique", "mollet_excentrique"],
      ["tractions_assistees", "pompes", "curl_biceps"],
      ["planche", "equilibre_unipodal", "extension_cheville_elastique"],
    ],
    cooldown: ["etirement_flechisseurs", "etirement_mollet_mur"],
  },
  lower_core: {
    warmup: ["cercles_hanche", "balancements_jambe"],
    trisets: [
      ["squat_bulgare", "fente_arriere", "pont_fessier_unipodal"],
      ["sdt_roumain_elastique", "mollet_excentrique", "abduction_elastique"],
      ["planche", "dead_bug", "equilibre_unipodal"],
    ],
    cooldown: ["pigeon", "etirement_flechisseurs"],
  },
  upper_core: {
    warmup: ["suspension_scapulaire", "ecartes_elastique"],
    trisets: [
      ["tractions_assistees", "tirage_vertical_genoux", "curl_biceps"],
      ["pompes", "dips_chaise", "extension_triceps_tete"],
      ["planche", "dead_bug", "planche_laterale"],
    ],
    cooldown: ["posture_enfant", "suspension_passive"],
  },
  legs: {
    warmup: ["cercles_hanche", "balancements_jambe"],
    trisets: [
      ["squat_bulgare", "step_up", "sdt_roumain_elastique"],
      ["pont_fessier_unipodal", "abduction_elastique", "fente_arriere"],
      ["mollet_excentrique", "extension_cheville_elastique", "equilibre_unipodal"],
    ],
    cooldown: ["pigeon", "etirement_mollet_mur"],
  },
  upper: {
    warmup: ["suspension_scapulaire", "ecartes_elastique"],
    trisets: [
      ["tractions_pronation", "tractions_assistees", "tirage_vertical_genoux"],
      ["pompes", "pompes_pieds_sureleves", "dips_chaise"],
      ["curl_biceps", "extension_triceps_tete", "developpe_epaules_elastique"],
    ],
    cooldown: ["posture_enfant", "suspension_passive"],
  },
  core_runner: {
    warmup: ["cercles_hanche", "balancements_jambe"],
    trisets: [
      ["planche", "dead_bug", "planche_laterale"],
      ["equilibre_unipodal", "atteintes_etoile", "mollet_excentrique"],
      ["pont_fessier_unipodal", "abduction_elastique", "planche_touchers_epaule"],
    ],
    cooldown: ["pigeon", "posture_enfant"],
  },
}

const valid = (kind: SessionKind = "full") => build(kind, SPECS[kind])
const lockOf = (kind: SessionKind) => SPECS[kind].trisets.flat()

// deno-lint-ignore no-explicit-any
type Mutable = any

/** Applique `mutate` à une copie de la séance valide du type et renvoie les erreurs. */
const errorsAfter = (mutate: (s: Mutable) => void, kind: SessionKind = "full", c: ValidationContext = ctxOf(kind)) => {
  const s: Mutable = valid(kind)
  mutate(s)
  return validateSessionContent(s, c)
}

const assertFails = (errors: string[], fragment: string) =>
  assert(
    errors.some((e) => e.includes(fragment)),
    `erreur contenant « ${fragment} » attendue, reçu : ${JSON.stringify(errors)}`,
  )

// ── Séances valides ──────────────────────────────────────────────────────────
for (const kind of Object.keys(SPECS) as SessionKind[]) {
  Deno.test(`${kind} : séance valide en trois trisets`, () => {
    assertEquals(validateSessionContent(valid(kind), ctxOf(kind)), [])
  })
}

Deno.test("verrou respecté, ordre libre dans chaque triset (legs)", () => {
  const lock = lockOf("legs")
  ;[lock[0], lock[2]] = [lock[2], lock[0]]
  ;[lock[6], lock[8]] = [lock[8], lock[6]]
  assertEquals(validateSessionContent(valid("legs"), { ...ctxOf("legs"), mainSlugs: lock }), [])
})

Deno.test("échauffement : extras autorisés hors catégorie warmup", () => {
  assertEquals(errorsAfter((s) => { s.blocks[0].items[0] = d("rotation_externe") }), [])
})

Deno.test("échauffement et retour au calme : un seul exercice accepté", () => {
  assertEquals(errorsAfter((s) => {
    s.blocks[0].items.pop()
    s.blocks[4].items.pop()
  }), [])
})

// ── Structure ────────────────────────────────────────────────────────────────
Deno.test("structure : contenu non objet", () => {
  assertFails(validateSessionContent(null, ctxOf("full")), "objet")
})

Deno.test("structure : titre manquant", () => {
  assertFails(errorsAfter((s) => { s.title = " " }), "Titre")
})

Deno.test("structure : deux trisets seulement, refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks.splice(3, 1) }), "exactement 5 blocs")
})

Deno.test("structure : ordre des blocs", () => {
  assertFails(errorsAfter((s) => { [s.blocks[0], s.blocks[4]] = [s.blocks[4], s.blocks[0]] }), "dans cet ordre")
})

Deno.test("structure : bloc principal refusé, quel que soit le type", () => {
  for (const kind of ["full", "upper"] as SessionKind[]) {
    assertFails(errorsAfter((s) => {
      s.blocks[1] = { type: "main", items: [{ ...d("pompes"), sets: 3, rest_sec: 90 }] }
    }, kind), "dans cet ordre")
  }
})

Deno.test("structure : échauffement à 3 exercices refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items.push(d("balancements_jambe")) }), "Échauffement : 1 à 2")
})

Deno.test("structure : échauffement vide refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items = [] }), "Échauffement : 1 à 2")
})

Deno.test("structure : retour au calme à 3 exercices refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[4].items.push(d("pigeon")) }), "Retour au calme : 1 à 2")
})

// ── Trisets : focus, membres, catégories, exigences ──────────────────────────
Deno.test("triset : focus à la mauvaise position, refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].focus = "posterior" }, "legs"), "Triset 1 : focus « quads »")
  assertFails(errorsAfter((s) => { delete s.blocks[3].focus }), "Triset 3 : focus « core_runner »")
})

Deno.test("triset : sans c, refusé", () => {
  assertFails(errorsAfter((s) => { delete s.blocks[1].c }), "Triset 1 : trois exercices")
})

Deno.test("triset : catégorie hors focus, refusée", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].c = d("dead_bug") }), "n'est pas autorisé")
})

Deno.test("full : triset upper sans poussée, refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].b = d("rowing_bucheron") }), "Triset 2 : au moins un exercice push attendu")
})

Deno.test("upper : triset pull à un seul tirage, refusé", () => {
  assertFails(
    errorsAfter((s) => {
      s.blocks[1].a = d("curl_marteau")
      s.blocks[1].c = d("rotation_externe")
    }, "upper"),
    "Triset 1 : au moins 2 exercices pull attendus",
  )
})

Deno.test("legs : triset posterior à un seul exercice de chaîne postérieure, refusé", () => {
  assertFails(
    errorsAfter((s) => {
      s.blocks[2].b = d("squat_saute")
    }, "legs"),
    "Triset 2 : au moins 2 exercices posterior_chain attendus",
  )
})

Deno.test("triset : bornes de tours et de repos", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].rounds = 5 }), "Triset 2 : rounds entier")
  assertFails(errorsAfter((s) => { s.blocks[3].rest_sec = 30 }), "Triset 3 : rest_sec entier")
})

// ── Dosage ───────────────────────────────────────────────────────────────────
Deno.test("dosage : durée sur un exercice en répétitions", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].a = { slug: "squat_bulgare", duration_sec: 30 } }), "en répétitions")
})

Deno.test("dosage : répétitions sur un exercice en durée", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a = { slug: "planche", reps: 10 } }), "en durée")
})

Deno.test("dosage : répétitions hors bornes ou non entières", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].a.reps = 40 }), "reps entier")
  assertFails(errorsAfter((s) => { s.blocks[1].a.reps = 10.5 }), "reps entier")
})

Deno.test("dosage : durée hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a.duration_sec = 120 }), "duration_sec entier")
})

// ── Matériel et élastiques ───────────────────────────────────────────────────
Deno.test("matériel : chaise indisponible", () => {
  assertFails(validateSessionContent(valid(), { ...ctxOf("full"), equipment: ["bar"] }), "indisponible (chair)")
})

Deno.test("matériel : aucune bande", () => {
  assertFails(validateSessionContent(valid(), { ...ctxOf("full"), bandsKg: [] }), "indisponible (band)")
})

Deno.test("élastique : band_kg manquant, absent de l'inventaire ou interdit", () => {
  assertFails(errorsAfter((s) => { delete s.blocks[2].c.band_kg }), "band_kg parmi")
  assertFails(errorsAfter((s) => { s.blocks[2].c.band_kg = 25 }), "band_kg parmi")
  assertFails(errorsAfter((s) => { s.blocks[2].b.band_kg = 10 }), "band_kg interdit")
})

// ── Doublons et barre ────────────────────────────────────────────────────────
Deno.test("doublon : même slug deux fois dans la séance", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].c = d("mollet_excentrique") }), "plusieurs fois")
})

Deno.test("barre : deux hauteurs dans un triset, refusé", () => {
  assertFails(
    errorsAfter((s) => { s.blocks[2].c = d("face_pull") }),
    "Triset 2 : barre utilisée à des hauteurs différentes",
  )
})

Deno.test("barre : trois hauteurs dans la séance, refusé", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].b = d("nordic_curl")
    s.blocks[3].a = d("pallof_press")
  }), "3 hauteurs")
})

// ── Verrou de cycle ──────────────────────────────────────────────────────────
Deno.test("verrou : 9 slugs non respectés (legs), refusé", () => {
  const lock = lockOf("legs")
  // Un exercice passé du triset 1 au triset 2.
  ;[lock[2], lock[5]] = [lock[5], lock[2]]
  const errors = validateSessionContent(valid("legs"), { ...ctxOf("legs"), mainSlugs: lock })
  assertFails(errors, "Triset 1 : exercices imposés pour ce cycle")
  assertFails(errors, "Triset 2 : exercices imposés pour ce cycle")
})

Deno.test("verrou : exercice remplacé (full), refusé", () => {
  const lock = lockOf("full")
  lock[4] = "pompes_elastique"
  assertFails(validateSessionContent(valid(), { ...ctxOf("full"), mainSlugs: lock }), "Triset 2 : exercices imposés")
})

// ── Règles effectives selon le matériel ──────────────────────────────────────
Deno.test("effectiveTrisetRules : sans barre, pull ramené à min 1", () => {
  const available = availableExercises(["chair"], BANDS)
  assertEquals(effectiveTrisetRules("pull", available), {
    categories: ["pull", "arms"],
    requires: [{ categories: ["pull"], min: 1 }],
  })
  // Avec la barre, le minimum reste 2.
  assertEquals(effectiveTrisetRules("pull", availableExercises(["chair", "bar"], BANDS)).requires[0].min, 2)
})

Deno.test("effectiveTrisetRules : catégorie et exigence sans exercice disponible retirées", () => {
  // Sans bande ni barre ni chaise : aucun exercice arms ni pull, il reste push.
  const rules = effectiveTrisetRules("shoulders_arms", availableExercises([], []))
  assertEquals(rules.categories, ["push"])
  assertEquals(rules.requires, [])
})

Deno.test("sans barre : triset pull à un seul tirage accepté (upper)", () => {
  const spec: Spec = {
    warmup: ["cercles_hanche", "ecartes_elastique"],
    trisets: [
      ["rowing_bucheron", "curl_biceps", "curl_marteau"],
      ["pompes", "pompes_pieds_sureleves", "dips_chaise"],
      ["extension_triceps_tete", "developpe_epaules_elastique", "rotation_externe"],
    ],
    cooldown: ["posture_enfant", "pigeon"],
  }
  assertEquals(validateSessionContent(build("upper", spec), { kind: "upper", equipment: ["chair"], bandsKg: BANDS }), [])
})

// ── Exercices figés ──────────────────────────────────────────────────────────
Deno.test("lockedSlugs : 9 slugs des trisets, pour full et les autres types", () => {
  assertEquals(lockedSlugs("full", valid("full")), lockOf("full"))
  assertEquals(lockedSlugs("upper_core", valid("upper_core")), lockOf("upper_core"))
})

Deno.test("lockedSlugs : contenu illisible", () => {
  assertEquals(lockedSlugs("full", null), [])
  assertEquals(lockedSlugs("legs", { blocks: "x" }), [])
})
