// Tests de la validation du contenu d'une séance Renfo. Exécution : deno test validate_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1"
import { type ValidationContext, validateSessionContent } from "./validate.ts"

const BANDS = [10, 15, 20, 30, 40]
const ctx: ValidationContext = { kind: "full", equipment: ["chair", "bar"], bandsKg: BANDS }

// Séance corps complet valide. Barre utilisée à une seule hauteur (high).
const valid = () => ({
  title: "Corps complet",
  blocks: [
    {
      type: "warmup",
      items: [
        { slug: "cercles_hanche", reps: 8 },
        { slug: "balancements_jambe", reps: 12 },
        { slug: "ecartes_elastique", reps: 15, band_kg: 10 },
      ],
    },
    {
      type: "main",
      items: [
        { slug: "squat_bulgare", sets: 3, reps: 10, rest_sec: 90 },
        { slug: "tractions_assistees", sets: 3, reps: 8, rest_sec: 90, band_kg: 30 },
      ],
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "planche", duration_sec: 45 },
      b: { slug: "curl_biceps", reps: 12, band_kg: 15 },
    },
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "mollet_excentrique", reps: 10 },
      b: { slug: "pont_fessier_unipodal", reps: 12 },
    },
    {
      type: "cooldown",
      items: [
        { slug: "etirement_flechisseurs", duration_sec: 40 },
        { slug: "pigeon", duration_sec: 40 },
        { slug: "etirement_mollet_mur", duration_sec: 40 },
      ],
    },
  ],
})

// deno-lint-ignore no-explicit-any
type Mutable = any

/** Applique `mutate` à une copie de la séance valide et renvoie les erreurs. */
const errorsAfter = (mutate: (s: Mutable) => void, c: ValidationContext = ctx): string[] => {
  const s: Mutable = valid()
  mutate(s)
  return validateSessionContent(s, c)
}

const assertFails = (errors: string[], fragment: string) =>
  assert(
    errors.some((e) => e.includes(fragment)),
    `erreur contenant « ${fragment} » attendue, reçu : ${JSON.stringify(errors)}`,
  )

Deno.test("séance valide : aucune erreur", () => {
  assertEquals(validateSessionContent(valid(), ctx), [])
})

Deno.test("séance valide : exercices principaux imposés dans un autre ordre", () => {
  assertEquals(
    validateSessionContent(valid(), { ...ctx, mainSlugs: ["tractions_assistees", "squat_bulgare"] }),
    [],
  )
})

Deno.test("échauffement : extras autorisés hors catégorie warmup", () => {
  assertEquals(errorsAfter((s) => { s.blocks[0].items[0] = { slug: "releves_pointes", reps: 20 } }), [])
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

Deno.test("structure : échauffement de 3 à 4 exercices", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items.pop() }), "Échauffement : 3 à 4")
})

Deno.test("structure : bloc principal de 2 à 3 exercices", () => {
  assertFails(errorsAfter((s) => { s.blocks[1].items.pop() }), "Bloc principal : 2 à 3")
})

Deno.test("structure : retour au calme de 3 à 4 exercices", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[4].items.push(
      { slug: "posture_enfant", duration_sec: 45 },
      { slug: "suspension_passive", duration_sec: 30 },
    )
  }), "Retour au calme : 3 à 4")
})

// ── Catalogue et catégories ──────────────────────────────────────────────────
Deno.test("catalogue : slug inconnu", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].a = { slug: "burpee", reps: 10 } }), "inconnu")
})

Deno.test("catégorie : interdite dans l'échauffement", () => {
  assertFails(errorsAfter((s) => { s.blocks[0].items[0] = { slug: "pompes", reps: 10 } }), "n'est pas autorisé")
})

Deno.test("catégorie : interdite dans le bloc principal", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[0] = { slug: "planche", sets: 3, duration_sec: 45, rest_sec: 60 }
  }), "n'est pas autorisé")
})

Deno.test("catégorie : interdite dans un superset", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].b = { slug: "pompes", reps: 10 } }), "n'est pas autorisé")
})

Deno.test("catégorie : retour au calme limité à cooldown", () => {
  assertFails(errorsAfter((s) => { s.blocks[4].items[0] = { slug: "planche_laterale", duration_sec: 30 } }), "n'est pas autorisé")
})

Deno.test("full : au moins un exercice du bas dans le bloc principal", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[0] = { slug: "pompes", sets: 3, reps: 12, rest_sec: 90 }
  }), "legs ou posterior_chain")
})

Deno.test("full : au moins un exercice du haut dans le bloc principal", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[1] = { slug: "fente_arriere", sets: 3, reps: 10, rest_sec: 90 }
  }), "pull ou push")
})

Deno.test("upper : au moins un tirage dans le bloc principal", () => {
  const upper: ValidationContext = { ...ctx, kind: "upper" }
  const errors = errorsAfter((s) => {
    s.blocks[1].items = [
      { slug: "pompes", sets: 3, reps: 12, rest_sec: 90 },
      { slug: "dips_chaise", sets: 3, reps: 12, rest_sec: 90 },
    ]
    s.blocks[2].a = { slug: "curl_marteau", reps: 12, band_kg: 15 }
    s.blocks[3].a = { slug: "extension_triceps_tete", reps: 12, band_kg: 10 }
    s.blocks[3].b = { slug: "face_pull", reps: 15, band_kg: 10 }
  }, upper)
  assertFails(errors, "au moins un exercice pull")
})

// ── Dosage ───────────────────────────────────────────────────────────────────
Deno.test("dosage : durée sur un exercice en répétitions", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].b = { slug: "pont_fessier_unipodal", duration_sec: 30 } }), "en répétitions")
})

Deno.test("dosage : répétitions sur un exercice en durée", () => {
  assertFails(errorsAfter((s) => { s.blocks[2].a = { slug: "planche", reps: 10 } }), "en durée")
})

Deno.test("dosage : répétitions hors bornes", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].b.reps = 40 }), "reps entier")
})

Deno.test("dosage : répétitions non entières", () => {
  assertFails(errorsAfter((s) => { s.blocks[3].b.reps = 10.5 }), "reps entier")
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
  assertFails(validateSessionContent(valid(), { ...ctx, equipment: ["bar"] }), "indisponible (chair)")
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
  assertFails(errorsAfter((s) => { s.blocks[3].b = { slug: "squat_bulgare", reps: 10 } }), "plusieurs fois")
})

Deno.test("barre : hauteurs différentes dans un superset", () => {
  const upper: ValidationContext = { ...ctx, kind: "upper_core" }
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[0] = { slug: "pompes", sets: 3, reps: 12, rest_sec: 90 }
    s.blocks[2].a = { slug: "releve_genoux_suspendu", reps: 10 }
    s.blocks[2].b = { slug: "face_pull", reps: 15, band_kg: 10 }
  }, upper), "hauteurs différentes")
})

Deno.test("barre : trois hauteurs dans la séance", () => {
  assertFails(errorsAfter((s) => {
    s.blocks[1].items[0] = { slug: "nordic_curl", sets: 3, reps: 5, rest_sec: 90 }
    s.blocks[2].a = { slug: "pallof_press", reps: 10, band_kg: 10 }
  }), "3 hauteurs")
})

Deno.test("exercices imposés : bloc principal différent", () => {
  assertFails(
    validateSessionContent(valid(), { ...ctx, mainSlugs: ["fente_arriere", "tractions_assistees"] }),
    "imposés",
  )
})
