// Tests de la validation du contenu d'une séance Renfo. Exécution : deno test validate_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import { lockedSlugs } from "./rules.ts"
import { type ValidationContext, validateSessionContent } from "./validate.ts"

const BANDS = [10, 15, 20, 30, 40]
const ctx: ValidationContext = { kind: "upper_core", equipment: ["chair", "bar"], bandsKg: BANDS }
const fullCtx: ValidationContext = { ...ctx, kind: "full" }

// Séance haut du corps et tronc valide (bloc principal et supersets A+B).
// Barre utilisée à une seule hauteur (high).
const valid = () => ({
  title: "Haut du corps et tronc",
  blocks: [
    {
      type: "warmup",
      items: [
        { slug: "suspension_scapulaire", reps: 10 },
        { slug: "ecartes_elastique", reps: 15, band_kg: 10 },
      ],
    },
    {
      type: "main",
      items: [
        { slug: "tractions_assistees", sets: 3, reps: 8, rest_sec: 90, band_kg: 30 },
        { slug: "pompes", sets: 3, reps: 12, rest_sec: 90 },
      ],
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "planche", duration_sec: 45 },
      b: { slug: "curl_biceps", reps: 12, band_kg: 15 },
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "dead_bug", reps: 10 },
      b: { slug: "extension_triceps_tete", reps: 12, band_kg: 10 },
    },
    {
      type: "cooldown",
      items: [
        { slug: "posture_enfant", duration_sec: 45 },
        { slug: "suspension_passive", duration_sec: 30 },
      ],
    },
  ],
})

// Corps complet valide en trois trisets. Barre utilisée à une seule hauteur (high).
const validFull = () => ({
  title: "Corps complet",
  blocks: [
    {
      type: "warmup",
      items: [
        { slug: "cercles_hanche", reps: 8 },
        { slug: "ecartes_elastique", reps: 15, band_kg: 10 },
      ],
    },
    {
      type: "superset", focus: "legs", rounds: 3, rest_sec: 75,
      a: { slug: "squat_bulgare", reps: 10 },
      b: { slug: "sdt_roumain_elastique", reps: 12, band_kg: 20 },
      c: { slug: "mollet_excentrique", reps: 10 },
    },
    {
      type: "superset", focus: "upper", rounds: 3, rest_sec: 75,
      a: { slug: "tractions_assistees", reps: 8, band_kg: 30 },
      b: { slug: "pompes", reps: 12 },
      c: { slug: "curl_biceps", reps: 12, band_kg: 15 },
    },
    {
      type: "superset", focus: "core_runner", rounds: 3, rest_sec: 60,
      a: { slug: "planche", duration_sec: 45 },
      b: { slug: "equilibre_unipodal", duration_sec: 30 },
      c: { slug: "extension_cheville_elastique", reps: 15, band_kg: 10 },
    },
    {
      type: "cooldown",
      items: [
        { slug: "etirement_flechisseurs", duration_sec: 40 },
        { slug: "etirement_mollet_mur", duration_sec: 40 },
      ],
    },
  ],
})

// Séance jambes valide.
const validLegs = () => ({
  title: "Jambes",
  blocks: [
    { type: "warmup", items: [{ slug: "cercles_hanche", reps: 8 }, { slug: "balancements_jambe", reps: 12 }] },
    {
      type: "main",
      items: [
        { slug: "squat_bulgare", sets: 3, reps: 10, rest_sec: 90 },
        { slug: "sdt_roumain_elastique", sets: 3, reps: 12, rest_sec: 90, band_kg: 20 },
      ],
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "fente_arriere", reps: 10 },
      b: { slug: "mollet_excentrique", reps: 10 },
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "step_up", reps: 10 },
      b: { slug: "pont_fessier_unipodal", reps: 12 },
    },
    { type: "cooldown", items: [{ slug: "pigeon", duration_sec: 40 }, { slug: "etirement_mollet_mur", duration_sec: 40 }] },
  ],
})

const FULL_LOCK = [
  "squat_bulgare", "sdt_roumain_elastique", "mollet_excentrique",
  "tractions_assistees", "pompes", "curl_biceps",
  "planche", "equilibre_unipodal", "extension_cheville_elastique",
]

// deno-lint-ignore no-explicit-any
type Mutable = any

/** Applique `mutate` à une copie de la séance et renvoie les erreurs. */
const errorsAfter = (
  mutate: (s: Mutable) => void,
  c: ValidationContext = ctx,
  make: () => Mutable = valid,
): string[] => {
  const s: Mutable = make()
  mutate(s)
  return validateSessionContent(s, c)
}

const fullErrorsAfter = (mutate: (s: Mutable) => void, c: ValidationContext = fullCtx) =>
  errorsAfter(mutate, c, validFull)

const assertFails = (errors: string[], fragment: string) =>
  assert(
    errors.some((e) => e.includes(fragment)),
    `erreur contenant « ${fragment} » attendue, reçu : ${JSON.stringify(errors)}`,
  )

Deno.test("séance valide : aucune erreur", () => {
  assertEquals(validateSessionContent(valid(), ctx), [])
  assertEquals(validateSessionContent(validLegs(), { ...ctx, kind: "legs" }), [])
})

Deno.test("séance valide : exercices principaux imposés dans un autre ordre", () => {
  assertEquals(
    validateSessionContent(valid(), { ...ctx, mainSlugs: ["pompes", "tractions_assistees"] }),
    [],
  )
})

Deno.test("échauffement : extras autorisés hors catégorie warmup", () => {
  assertEquals(errorsAfter((s) => { s.blocks[0].items[0] = { slug: "rotation_externe", reps: 15, band_kg: 10 } }), [])
})

Deno.test("échauffement et retour au calme : un seul exercice accepté", () => {
  assertEquals(errorsAfter((s) => {
    s.blocks[0].items.pop()
    s.blocks[4].items.pop()
  }), [])
})

// ── Structure ────────────────────────────────────────────────────────────────
Deno.test("structure : contenu non objet", () => {
  assertFails(validateSessionContent(null, ctx), "objet")
})

Deno.test("structure : titre manquant", () => {
  assertFails(errorsAfter((s) => { s.title = " " }), "Titre")
})

Deno.test("structure : nombre de blocs", () => {
  assertFails(errorsAfter((s) => { s.blocks.pop() }), "exactement 5 blocs")
})

Deno.test("structure : ordre des blocs", () => {
  assertFails(errorsAfter((s) => { [s.blocks[0], s.blocks[4]] = [s.blocks[4], s.blocks[0]] }), "dans cet ordre")
})

Deno.test("structure : échauffement à 3 exercices refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items.push({ slug: "cercles_hanche", reps: 8 }) }), "Échauffement : 1 à 2")
})

Deno.test("structure : échauffement vide refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items = [] }), "Échauffement : 1 à 2")
})

Deno.test("structure : bloc principal de 2 à 3 exercices", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].items.pop() }), "Bloc principal : 2 à 3")
})

Deno.test("structure : retour au calme à 3 exercices refusé", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[4].items.push({ slug: "pigeon", duration_sec: 40 })
  }), "Retour au calme : 1 à 2")
})

// ── Catalogue et catégories ──────────────────────────────────────────────────
Deno.test("catalogue : slug inconnu", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a = { slug: "burpee", reps: 10 } }), "inconnu")
})

Deno.test("catégorie : interdite dans l'échauffement", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items[0] = { slug: "fente_arriere", reps: 10 } }), "n'est pas autorisé")
})

Deno.test("catégorie : interdite dans le bloc principal", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[0] = { slug: "planche_laterale", sets: 3, duration_sec: 30, rest_sec: 60 }
  }), "n'est pas autorisé")
})

Deno.test("catégorie : interdite dans un superset", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].b = { slug: "squat_bulgare", reps: 10 } }), "n'est pas autorisé")
})

Deno.test("catégorie : retour au calme limité à cooldown", () => {
  assertFails(errorsAfter((s) => { s.blocks[4].items[0] = { slug: "planche_laterale", duration_sec: 30 } }), "n'est pas autorisé")
})

Deno.test("upper : au moins un tirage dans le bloc principal", () => {
  const upper: ValidationContext = { ...ctx, kind: "upper" }
  const errors = errorsAfter((s) => {
    s.blocks[1].items = [
      { slug: "pompes", sets: 3, reps: 12, rest_sec: 90 },
      { slug: "dips_chaise", sets: 3, reps: 12, rest_sec: 90 },
    ]
    s.blocks[2].a = { slug: "curl_marteau", reps: 12, band_kg: 15 }
    s.blocks[3].a = { slug: "face_pull", reps: 15, band_kg: 10 }
  }, upper)
  assertFails(errors, "au moins un exercice pull")
})

// ── Dosage ───────────────────────────────────────────────────────────────────
Deno.test("dosage : durée sur un exercice en répétitions", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a = { slug: "dead_bug", duration_sec: 30 } }), "en répétitions")
})

Deno.test("dosage : répétitions sur un exercice en durée", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].a = { slug: "planche", reps: 10 } }), "en durée")
})

Deno.test("dosage : répétitions hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a.reps = 40 }), "reps entier")
})

Deno.test("dosage : répétitions non entières", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a.reps = 10.5 }), "reps entier")
})

Deno.test("dosage : durée hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].a.duration_sec = 120 }), "duration_sec entier")
})

Deno.test("dosage : séries du bloc principal hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].items[0].sets = 6 }), "sets entier")
})

Deno.test("dosage : repos du bloc principal hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].items[0].rest_sec = 30 }), "rest_sec entier entre 45 et 180")
})

Deno.test("dosage : tours de superset hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].rounds = 5 }), "rounds entier")
})

Deno.test("dosage : repos de superset hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].rest_sec = 150 }), "rest_sec entier entre 45 et 120")
})

// ── Matériel et élastiques ───────────────────────────────────────────────────
Deno.test("matériel : chaise indisponible", () => {
  assertFails(validateSessionContent(validFull(), { ...fullCtx, equipment: ["bar"] }), "indisponible (chair)")
})

Deno.test("matériel : aucune bande", () => {
  assertFails(validateSessionContent(valid(), { ...ctx, bandsKg: [] }), "indisponible (band)")
})

Deno.test("élastique : band_kg manquant", () => {
  assertFails(errorsAfter((s) => { delete s.blocks[2].b.band_kg }), "band_kg parmi")
})

Deno.test("élastique : band_kg absent de l'inventaire", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].b.band_kg = 25 }), "band_kg parmi")
})

Deno.test("élastique : band_kg sur un exercice sans élastique", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a.band_kg = 10 }), "band_kg interdit")
})

// ── Doublons, barre, exercices imposés ───────────────────────────────────────
Deno.test("doublon : même slug deux fois dans la séance", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].b = { slug: "pompes", reps: 10 } }), "plusieurs fois")
})

Deno.test("barre : hauteurs différentes dans un superset", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[2].a = { slug: "releve_genoux_suspendu", reps: 10 }
    s.blocks[2].b = { slug: "face_pull", reps: 15, band_kg: 10 }
  }), "hauteurs différentes")
})

Deno.test("barre : trois hauteurs dans la séance", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[2].a = { slug: "pallof_press", reps: 10, band_kg: 10 }
    s.blocks[3].a = { slug: "rowing_inverse", reps: 10 }
  }), "3 hauteurs")
})

Deno.test("exercices imposés : bloc principal différent", () => {
  assertFails(
    validateSessionContent(valid(), { ...ctx, mainSlugs: ["dips_chaise", "tractions_assistees"] }),
    "imposés",
  )
})

// ── Supersets hors corps complet ─────────────────────────────────────────────
Deno.test("legs : superset avec un c refusé", () => {
  const errors = errorsAfter((s) => {
    s.blocks[2].c = { slug: "abduction_elastique", reps: 15, band_kg: 10 }
  }, { ...ctx, kind: "legs" }, validLegs)
  assertFails(errors, "Superset 1 : deux exercices a et b seulement")
})

Deno.test("superset hors corps complet : focus refusé", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].focus = "upper" }), "ni c ni focus")
})

// ── Corps complet en trisets ─────────────────────────────────────────────────
Deno.test("full : trois trisets valides", () => {
  assertEquals(validateSessionContent(validFull(), fullCtx), [])
})

Deno.test("full : verrou respecté, ordre libre dans chaque triset", () => {
  const lock = [...FULL_LOCK]
  ;[lock[0], lock[2]] = [lock[2], lock[0]]
  ;[lock[6], lock[7]] = [lock[7], lock[6]]
  assertEquals(validateSessionContent(validFull(), { ...fullCtx, mainSlugs: lock }), [])
})

Deno.test("full : deux supersets seulement, refusé", () => {
  assertFails(fullErrorsAfter((s) => { s.blocks.splice(3, 1) }), "exactement 5 blocs")
})

Deno.test("full : ancien format avec bloc principal, refusé", () => {
  assertFails(fullErrorsAfter((s) => {
    s.blocks[1] = { type: "main", items: [{ slug: "squat_bulgare", sets: 3, reps: 10, rest_sec: 90 }] }
  }), "dans cet ordre")
})

Deno.test("full : triset sans c, refusé", () => {
  assertFails(fullErrorsAfter((s) => { delete s.blocks[1].c }), "Triset 1 : trois exercices")
})

Deno.test("full : focus absent ou à la mauvaise position, refusé", () => {
  assertFails(fullErrorsAfter((s) => { delete s.blocks[3].focus }), "Triset 3 : focus « core_runner »")
  assertFails(fullErrorsAfter((s) => { s.blocks[1].focus = "upper" }), "Triset 1 : focus « legs »")
})

Deno.test("full : triset upper sans poussée, refusé", () => {
  assertFails(
    fullErrorsAfter((s) => { s.blocks[2].b = { slug: "rowing_bucheron", reps: 12, band_kg: 20 } }),
    "Triset 2 : au moins un exercice push",
  )
})

Deno.test("full : triset legs sans exercice legs, refusé", () => {
  assertFails(
    fullErrorsAfter((s) => { s.blocks[1].a = { slug: "pont_fessier_unipodal", reps: 12 } }),
    "Triset 1 : au moins un exercice legs",
  )
})

Deno.test("full : catégorie hors focus, refusée", () => {
  assertFails(fullErrorsAfter((s) => { s.blocks[1].c = { slug: "dead_bug", reps: 10 } }), "n'est pas autorisé")
})

Deno.test("full : triset avec deux hauteurs de barre, refusé", () => {
  assertFails(
    fullErrorsAfter((s) => { s.blocks[2].c = { slug: "face_pull", reps: 15, band_kg: 10 } }),
    "Triset 2 : barre utilisée à des hauteurs différentes",
  )
})

Deno.test("full : bornes de tours et de repos des trisets", () => {
  assertFails(fullErrorsAfter((s) => { s.blocks[2].rounds = 5 }), "Triset 2 : rounds entier")
  assertFails(fullErrorsAfter((s) => { s.blocks[3].rest_sec = 30 }), "Triset 3 : rest_sec entier")
})

Deno.test("full : verrou non respecté, refusé", () => {
  const lock = [...FULL_LOCK]
  // Un exercice passé du triset 1 au triset 2.
  ;[lock[2], lock[5]] = [lock[5], lock[2]]
  const errors = validateSessionContent(validFull(), { ...fullCtx, mainSlugs: lock })
  assertFails(errors, "Triset 1 : exercices imposés pour ce cycle")
  assertFails(errors, "Triset 2 : exercices imposés pour ce cycle")
})

// ── Exercices figés ──────────────────────────────────────────────────────────
Deno.test("lockedSlugs : 9 slugs des trisets pour le corps complet", () => {
  assertEquals(lockedSlugs("full", validFull()), FULL_LOCK)
})

Deno.test("lockedSlugs : bloc principal pour les autres types", () => {
  assertEquals(lockedSlugs("upper_core", valid()), ["tractions_assistees", "pompes"])
  assertEquals(lockedSlugs("legs", validLegs()), ["squat_bulgare", "sdt_roumain_elastique"])
})

Deno.test("lockedSlugs : contenu illisible", () => {
  assertEquals(lockedSlugs("full", null), [])
  assertEquals(lockedSlugs("legs", { blocks: "x" }), [])
})
