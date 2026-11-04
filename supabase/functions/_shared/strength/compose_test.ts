// Tests des séances composées (lot R1). Exécution : deno test compose_test.ts
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { availableExercises, EXERCISE_INDEX } from "./catalog.ts"
import {
  ajuster, assembler, bandeDuMilieu, type Choix, compositionDe, type Composition, derniereFois, doseDe,
  type DoneSession, estNouveauFormat, exercicesDuTheme, exercicesRecents, groupesTries, planMiseAJour,
  preremplir, remplacants, remplacer, repartition, titreSeance, validateComposition, validerChoix,
} from "./compose.ts"
import { estimateSessionMinutes } from "./estimate.ts"
import { groupOfFocus, type SessionContent, SUPERSET_REST_SEC } from "./rules.ts"

const BANDS = [5, 10, 15, 20, 30]
const FULL = availableExercises(["bar", "chair"], BANDS)
const NOTHING = availableExercises([], [])

const superset = (focus: string, ...slugs: string[]) => ({
  type: "superset", focus, rounds: 3, rest_sec: 60, exercises: slugs.map((slug) => ({ slug, reps: 10 })),
})

const done = (date: string, ...focuses: string[]): DoneSession => ({
  completed_at: `${date}T18:00:00+00:00`,
  status: "done",
  content: { blocks: focuses.map((f) => superset(f, "pompes", "planche")) },
})

const errorsOf = (errors: string[], part: string) =>
  assert(errors.some((e) => e.includes(part)), `erreur « ${part} » attendue, reçu : ${JSON.stringify(errors)}`)

// ── Préremplissage ───────────────────────────────────────────────────────────

Deno.test("cas réel : Jambes et Tronc le 20 octobre, Haut du corps le 24, intensité normale", () => {
  const sessions = [done("2026-10-20", "quads", "posterior", "trunk"), done("2026-10-24", "pull", "push", "shoulders_arms")]
  const composition = preremplir({ intensity: "normale", sessions, available: FULL })
  assertEquals(composition.intensity, "normale")
  assertEquals(composition.supersets.map((s) => groupOfFocus(s.focus)), ["jambes", "jambes", "tronc"])
  // Thèmes jamais travaillés d'abord, dans l'ordre de THEMES_BY_GROUP, distincts.
  assertEquals(composition.supersets.map((s) => s.focus), ["legs", "foot_calf", "core_stability"])
  assert(composition.supersets.every((s) => s.exercise_count === 3 && s.rounds === 3))
  assertEquals(titreSeance(composition.supersets.map((s) => s.focus)), "Jambes et tronc")
})

Deno.test("préremplissage : thème le plus ancien du groupe, égalité selon THEMES_BY_GROUP", () => {
  const sessions = [
    done("2026-10-10", "legs"), done("2026-10-12", "quads"), done("2026-10-14", "posterior"),
    done("2026-10-16", "foot_calf"), done("2026-10-01", "pull"), done("2026-10-02", "trunk"),
  ]
  // Haut du corps le plus ancien (1er), puis tronc (2), jambes (16).
  const c = preremplir({ intensity: "soutenue", sessions, available: FULL })
  assertEquals(c.supersets.map((s) => s.focus), ["push", "shoulders_arms", "core_stability", "legs"])
})

Deno.test("repartition : 1, 2, 3 et 4 supersets", () => {
  const g = ["tronc", "jambes", "haut"] as const
  assertEquals(repartition(1, [...g]), ["tronc"])
  assertEquals(repartition(2, [...g]), ["tronc", "jambes"])
  assertEquals(repartition(3, [...g]), ["tronc", "tronc", "jambes"])
  assertEquals(repartition(4, [...g]), ["tronc", "tronc", "jambes", "haut"])
  assertEquals(repartition(4, ["jambes"]), ["jambes", "jambes", "jambes", "jambes"])
  assertEquals(repartition(2, []), [])
})

Deno.test("groupesTries : jamais travaillé d'abord, égalité selon GROUP_ORDER", () => {
  assertEquals(groupesTries(derniereFois([]), FULL), ["jambes", "tronc", "haut"])
  assertEquals(groupesTries(derniereFois([done("2026-10-20", "legs")]), FULL), ["tronc", "haut", "jambes"])
  assertEquals(
    groupesTries(derniereFois([done("2026-10-20", "legs", "trunk"), done("2026-10-19", "pull")]), FULL),
    ["haut", "jambes", "tronc"],
  )
})

Deno.test("derniereFois : anciens thèmes rangés dans leur groupe, sans dater de thème", () => {
  const d = derniereFois([
    done("2026-10-01", "lower_legs"), done("2026-10-02", "posterior_calves"),
    done("2026-10-03", "upper"), done("2026-10-04", "core_runner"),
  ])
  assertEquals(d.groupes, {
    jambes: "2026-10-02T18:00:00+00:00",
    haut: "2026-10-03T18:00:00+00:00",
    tronc: "2026-10-04T18:00:00+00:00",
  })
  assertEquals(d.themes, {})
  assertEquals(groupOfFocus("lower_legs"), "jambes")
  assertEquals(groupOfFocus("posterior_calves"), "jambes")
  assertEquals(groupOfFocus("upper"), "haut")
  assertEquals(groupOfFocus("core_runner"), "tronc")
})

Deno.test("derniereFois : superset sans focus, bloc principal et séance à faire ignorés", () => {
  const d = derniereFois([
    {
      completed_at: "2026-10-05T10:00:00+00:00",
      content: {
        blocks: [
          { type: "main", items: [{ slug: "squat_bulgare", sets: 3, reps: 10, rest_sec: 90 }] },
          { type: "superset", rounds: 3, rest_sec: 60, a: { slug: "pompes", reps: 10 }, b: { slug: "planche", duration_sec: 30 } },
        ],
      },
    },
    { completed_at: "2026-10-06T10:00:00+00:00", status: "planned", content: { blocks: [superset("legs", "pompes")] } },
  ])
  assertEquals(d, { groupes: {}, themes: {} })
})

Deno.test("sans matériel : pull n'est jamais proposé", () => {
  assertEquals(exercicesDuTheme("pull", NOTHING).length, 0)
  const histories = [[], [done("2026-10-20", "legs", "trunk")], [done("2026-10-20", "push", "shoulders_arms")]]
  for (const sessions of histories) {
    for (const intensity of ["legere", "normale", "soutenue"] as const) {
      const c = preremplir({ intensity, sessions, available: NOTHING })
      assert(c.supersets.every((s) => s.focus !== "pull"), JSON.stringify(c))
      assertEquals(validateComposition(c, NOTHING), [])
    }
  }
  errorsOf(validateComposition({ intensity: "normale", supersets: [{ focus: "pull", exercise_count: 2, rounds: 3 }] }, NOTHING), "au plus pour ce thème")
})

Deno.test("préremplissage sans matériel : total ramené aux exercices différents des thèmes", () => {
  const c = preremplir({ intensity: "soutenue", sessions: [], available: NOTHING })
  assertEquals(validateComposition(c, NOTHING), [])
  assert(c.supersets.length >= 1 && c.supersets.every((s) => s.exercise_count >= 2))
})

Deno.test("préremplissage : exercise_count ramené au nombre d'exercices du thème", () => {
  const c = preremplir({ intensity: "soutenue", sessions: [done("2026-10-20", "legs", "trunk")], available: NOTHING })
  const push = c.supersets.find((s) => s.focus === "push")
  assertEquals(push?.exercise_count, 2)
})

// ── Titre et composition ─────────────────────────────────────────────────────

Deno.test("titreSeance : un, deux et trois groupes", () => {
  assertEquals(titreSeance(["quads", "posterior"]), "Jambes")
  assertEquals(titreSeance(["legs", "trunk", "legs"]), "Jambes et tronc")
  assertEquals(titreSeance(["pull", "core_stability"]), "Haut du corps et tronc")
  assertEquals(titreSeance(["push", "legs"]), "Haut du corps et jambes")
  assertEquals(titreSeance(["legs", "pull", "trunk"]), "Corps complet")
})

const COMPOSITION: Composition = {
  intensity: "normale",
  supersets: [
    { focus: "quads", exercise_count: 3, rounds: 4 },
    { focus: "pull", exercise_count: 2, rounds: 1 },
    { focus: "core_stability", exercise_count: 4, rounds: 5 },
  ],
}

const CHOIX: Choix = {
  warmup: [{ slug: "cercles_hanche" }, { slug: "ecartes_elastique", band_kg: 10 }],
  supersets: [
    { position: 1, exercises: [{ slug: "squat_bulgare" }, { slug: "squat_elastique", band_kg: 20 }, { slug: "sdt_roumain_elastique", band_kg: 20 }] },
    { position: 2, exercises: [{ slug: "tractions_assistees", band_kg: 30 }, { slug: "tirage_vertical_genoux", band_kg: 20 }] },
    { position: 3, exercises: [{ slug: "planche" }, { slug: "dead_bug" }, { slug: "pallof_press", band_kg: 10 }, { slug: "planche_laterale" }] },
  ],
  cooldown: [{ slug: "posture_enfant" }],
}

const assemble = (bases = {}) =>
  assembler({ composition: COMPOSITION, choix: CHOIX, gardes: [null, null, null], bases, bandsKg: BANDS })

Deno.test("assembler : contenu au nouveau format, repos, titre, intensité et durée posés par le code", () => {
  const content = assemble({ squat_bulgare: { reps: 12 } })
  assertEquals(content.title, "Corps complet")
  assertEquals(content.intensity, "normale")
  assertEquals(content.blocks.map((b) => b.type), ["warmup", "superset", "superset", "superset", "cooldown"])
  const s1 = content.blocks[1]
  assert(s1.type === "superset")
  assertEquals(s1.rest_sec, SUPERSET_REST_SEC)
  assertEquals(s1.rounds, 4)
  assertEquals(s1.exercises?.[0], { slug: "squat_bulgare", reps: 12 })
  assertEquals(s1.exercises?.[1], { slug: "squat_elastique", reps: 15, band_kg: 20 })
  assertEquals(content.estimated_min, estimateSessionMinutes(content))
  assert(estNouveauFormat(content))
})

Deno.test("compositionDe : aller-retour avec assembler", () => {
  assertEquals(compositionDe(assemble()), COMPOSITION)
  const sans = { ...assemble(), intensity: undefined }
  assertEquals(compositionDe(sans).intensity, "normale")
})

Deno.test("validateComposition : composition valide", () => {
  assertEquals(validateComposition(COMPOSITION, FULL), [])
})

Deno.test("validateComposition : chaque erreur", () => {
  const ok = { focus: "legs", exercise_count: 3, rounds: 3 }
  const check = (composition: unknown, part: string, available = FULL) => errorsOf(validateComposition(composition, available), part)
  check(null, "objet")
  check({ intensity: "forte", supersets: [ok] }, "Intensité inconnue")
  check({ intensity: "normale", supersets: [] }, "1 à 4 supersets")
  check({ intensity: "normale", supersets: [ok, ok, ok, ok, ok] }, "1 à 4 supersets")
  check({ intensity: "normale", supersets: [{ ...ok, focus: "upper" }] }, "thème inconnu")
  check({ intensity: "normale", supersets: [{ ...ok, focus: "danse" }] }, "thème inconnu")
  check({ intensity: "normale", supersets: [{ ...ok, exercise_count: 1 }] }, "2 à 4 exercices")
  check({ intensity: "normale", supersets: [{ ...ok, exercise_count: 5 }] }, "2 à 4 exercices")
  check({ intensity: "normale", supersets: [{ ...ok, rounds: 0 }] }, "1 à 5 tours")
  check({ intensity: "normale", supersets: [{ ...ok, rounds: 6 }] }, "1 à 5 tours")
  check({ intensity: "normale", supersets: [{ focus: "push", exercise_count: 3, rounds: 3 }] }, "au plus pour ce thème", NOTHING)
  // push et shoulders_arms partagent les 2 mêmes exercices sans matériel.
  check({
    intensity: "normale",
    supersets: [{ focus: "push", exercise_count: 2, rounds: 3 }, { focus: "shoulders_arms", exercise_count: 2, rounds: 3 }],
  }, "Trop d'exercices", NOTHING)
})

// ── Dosage ───────────────────────────────────────────────────────────────────

Deno.test("doseDe : base, référence, mode durée", () => {
  const ex = EXERCISE_INDEX
  assertEquals(doseDe(ex.squat_elastique, { base: { reps: 18, band_kg: 20 }, bandsKg: BANDS }), { slug: "squat_elastique", reps: 18, band_kg: 20 })
  assertEquals(doseDe(ex.pompes, { bandsKg: BANDS }), { slug: "pompes", reps: 12 })
  assertEquals(doseDe(ex.planche, { base: { duration_sec: 60 }, bandsKg: BANDS }), { slug: "planche", duration_sec: 60 })
  assertEquals(doseDe(ex.planche, { base: { reps: 8, duration_sec: null }, bandsKg: BANDS }), { slug: "planche", duration_sec: 45 })
  // Pas de band_kg sans élastique, même si la base en a un.
  assertEquals(doseDe(ex.pompes, { base: { reps: 15, band_kg: 10 }, bandsKg: BANDS }), { slug: "pompes", reps: 15 })
})

Deno.test("doseDe : bande disparue ramenée à la plus proche, la plus légère en cas d'égalité", () => {
  const ex = EXERCISE_INDEX.curl_marteau
  assertEquals(doseDe(ex, { base: { band_kg: 27 }, bandsKg: [10, 20, 30] }).band_kg, 30)
  assertEquals(doseDe(ex, { base: { band_kg: 25 }, bandsKg: [30, 10, 20] }).band_kg, 20)
  assertEquals(doseDe(ex, { base: { band_kg: 40 }, bandsKg: [10, 20, 30] }).band_kg, 30)
})

Deno.test("doseDe : élastique choisi, sinon bande du milieu avec 4 et 5 bandes", () => {
  const ex = EXERCISE_INDEX.curl_marteau
  assertEquals(doseDe(ex, { bandsKg: BANDS, bandChoisie: 30 }).band_kg, 30)
  assertEquals(doseDe(ex, { base: { band_kg: 5 }, bandsKg: BANDS, bandChoisie: 30 }).band_kg, 5)
  assertEquals(doseDe(ex, { bandsKg: [20, 5, 15, 10] }).band_kg, 10)
  assertEquals(doseDe(ex, { bandsKg: [5, 10, 15, 20, 30] }).band_kg, 15)
  assertEquals(bandeDuMilieu([]), null)
  assertEquals(doseDe(ex, { bandsKg: [] }), { slug: "curl_marteau", reps: 12 })
})

// ── Remplacement et ajustement ───────────────────────────────────────────────

const SEANCE: SessionContent = {
  title: "Corps complet",
  estimated_min: 0,
  intensity: "normale",
  blocks: [
    { type: "warmup", items: [{ slug: "cercles_hanche", reps: 8 }] },
    {
      type: "superset", focus: "pull", rounds: 3, rest_sec: 60, exercises: [
        { slug: "tractions_assistees", reps: 8, band_kg: 30 },
        { slug: "tirage_vertical_genoux", reps: 12, band_kg: 20 },
        { slug: "curl_biceps", reps: 12, band_kg: 15 },
      ],
    },
    {
      type: "superset", focus: "core_stability", rounds: 3, rest_sec: 60, exercises: [
        { slug: "pallof_press", reps: 10, band_kg: 10 },
        { slug: "planche", duration_sec: 45 },
        { slug: "dead_bug", reps: 10 },
      ],
    },
    {
      type: "superset", focus: "posterior", rounds: 3, rest_sec: 60, exercises: [
        { slug: "sdt_roumain_elastique", reps: 12, band_kg: 20 },
        { slug: "pont_fessier_unipodal", reps: 12 },
        { slug: "marche_laterale", reps: 12, band_kg: 10 },
      ],
    },
    { type: "cooldown", items: [{ slug: "posture_enfant", duration_sec: 45 }] },
  ],
}

const slugsOf = (list: { slug: string }[]) => list.map((e) => e.slug)

Deno.test("remplacants : même catégorie, absents de la séance, une seule hauteur dans le superset", () => {
  // Superset de tirage à barre en haut : mid et low exclus.
  assertEquals(slugsOf(remplacants(SEANCE, 1, "tirage_vertical_genoux", FULL)), [
    "tractions_pronation", "tractions_supination", "tractions_negatives", "rowing_bucheron",
  ])
  // Superset gainage à barre mi-hauteur : relevés suspendus (haut) exclus.
  assertEquals(slugsOf(remplacants(SEANCE, 2, "planche", FULL)), ["planche_laterale", "copenhague", "planche_touchers_epaule"])
})

Deno.test("remplacants : deux hauteurs de barre au plus sur la séance", () => {
  // La séance utilise déjà le haut et la mi-hauteur : nordic_curl et kickback (bas) exclus.
  assertEquals(slugsOf(remplacants(SEANCE, 3, "pont_fessier_unipodal", FULL)), ["abduction_elastique"])
  // Remplacer le seul exercice à mi-hauteur libère une hauteur : la barre en bas redevient possible.
  const r = slugsOf(remplacants(SEANCE, 2, "pallof_press", FULL))
  assert(r.includes("releve_genoux_suspendu"))
  assert(!r.includes("dead_bug"))
  assertEquals(remplacants(SEANCE, 1, "planche", FULL), [])
})

Deno.test("remplacer et ajuster : nouveau contenu, durée recalculée, original intact", () => {
  const avant = structuredClone(SEANCE)
  const r = remplacer(SEANCE, 1, "tirage_vertical_genoux", { slug: "rowing_bucheron", reps: 12, band_kg: 20 })
  const b = r.blocks[1]
  assert(b.type === "superset")
  assertEquals(slugsOf(b.exercises ?? []), ["tractions_assistees", "rowing_bucheron", "curl_biceps"])
  assertEquals(r.estimated_min, estimateSessionMinutes(r))
  const a = ajuster(SEANCE, "planche", { slug: "planche", duration_sec: 60 })
  const c = a.blocks[2]
  assert(c.type === "superset")
  assertEquals(c.exercises?.[1], { slug: "planche", duration_sec: 60 })
  assertEquals(a.estimated_min, estimateSessionMinutes(a))
  assertEquals(SEANCE, avant)
})

Deno.test("estNouveauFormat : anciens formats refusés", () => {
  assert(estNouveauFormat(SEANCE))
  assert(!estNouveauFormat({ blocks: [{ type: "superset", focus: "legs", rounds: 3, rest_sec: 60, a: {}, b: {}, c: {} }] }))
  assert(!estNouveauFormat({ blocks: [{ type: "warmup", items: [] }] }))
  assert(!estNouveauFormat(null))
})

// ── Choix du modèle ──────────────────────────────────────────────────────────

const ctx = (over = {}) => ({
  demande: {
    supersets: [
      { position: 1, focus: "quads" as const, exercise_count: 3 },
      { position: 2, focus: "pull" as const, exercise_count: 2 },
      { position: 3, focus: "core_stability" as const, exercise_count: 4 },
    ],
    echauffement: true,
  },
  gardes: [],
  available: FULL,
  bandsKg: BANDS,
  avecBase: [],
  ...over,
})

const withChoix = (fn: (c: Choix) => void) => {
  const c = structuredClone(CHOIX)
  fn(c)
  return c
}

Deno.test("validerChoix : choix valide", () => {
  assertEquals(validerChoix(CHOIX, ctx()), [])
})

Deno.test("validerChoix : slug inconnu, matériel indisponible, catégorie", () => {
  errorsOf(validerChoix(withChoix((c) => { c.supersets[0].exercises[0].slug = "burpee" }), ctx()), "inconnu")
  errorsOf(validerChoix(CHOIX, ctx({ available: availableExercises(["chair"], BANDS) })), "matériel indisponible")
  errorsOf(validerChoix(withChoix((c) => { c.supersets[0].exercises[0].slug = "pompes" }), ctx()), "n'est pas autorisé")
  errorsOf(validerChoix(withChoix((c) => { c.warmup = [{ slug: "pompes" }] }), ctx()), "Échauffement 1")
  errorsOf(validerChoix(withChoix((c) => { c.cooldown = [{ slug: "cercles_hanche" }] }), ctx()), "Retour au calme 1")
})

Deno.test("validerChoix : exigences ramenées au nombre d'exercices du superset", () => {
  // quads demande 2 exercices legs : un seul legs sur trois, refusé.
  errorsOf(validerChoix(withChoix((c) => { c.supersets[0].exercises[1] = { slug: "pont_fessier_unipodal" } }), ctx()), "au moins 2 exercices legs")
  // core_stability demande 2 core : à 2 exercices, 2 core suffisent ; un équilibre et un core refusé.
  const deux = ctx({ demande: { supersets: [{ position: 1, focus: "core_stability", exercise_count: 2 }], echauffement: false } })
  assertEquals(validerChoix({ supersets: [{ position: 1, exercises: [{ slug: "planche" }, { slug: "dead_bug" }] }] }, deux), [])
  errorsOf(
    validerChoix({ supersets: [{ position: 1, exercises: [{ slug: "planche" }, { slug: "equilibre_unipodal" }] }] }, deux),
    "au moins 2 exercices core",
  )
})

Deno.test("validerChoix : doublons, exercices gardés compris, et nombre exact", () => {
  errorsOf(validerChoix(withChoix((c) => { c.supersets[2].exercises[3] = { slug: "planche" } }), ctx()), "plusieurs fois")
  errorsOf(validerChoix(CHOIX, ctx({ gardes: ["dead_bug"] })), "plusieurs fois")
  errorsOf(validerChoix(withChoix((c) => { c.supersets[1].exercises.pop() }), ctx()), "exactement 2 exercices")
  errorsOf(validerChoix(withChoix((c) => { c.supersets.pop() }), ctx()), "positions 1, 2, 3")
  errorsOf(validerChoix(withChoix((c) => { c.warmup = [] }), ctx()), "Échauffement : 1 à 2")
})

Deno.test("validerChoix : barre, une hauteur par superset et deux par séance", () => {
  errorsOf(
    validerChoix(withChoix((c) => { c.supersets[1].exercises[1] = { slug: "face_pull", band_kg: 10 } }), ctx()),
    "une seule par superset",
  )
  // Gardés en bas, choix en haut et à mi-hauteur : trois hauteurs.
  errorsOf(validerChoix(CHOIX, ctx({ gardes: ["nordic_curl"] })), "deux au plus par séance")
})

Deno.test("validerChoix : band_kg demandé seulement sans base, parmi les bandes du compte", () => {
  errorsOf(validerChoix(withChoix((c) => { delete c.supersets[1].exercises[0].band_kg }), ctx()), "band_kg")
  errorsOf(validerChoix(withChoix((c) => { c.supersets[1].exercises[0].band_kg = 25 }), ctx()), "band_kg")
  assertEquals(validerChoix(withChoix((c) => { delete c.supersets[1].exercises[0].band_kg }), ctx({ avecBase: ["tractions_assistees"] })), [])
})

Deno.test("validerChoix : échauffement non demandé, ignoré", () => {
  const sans = ctx({ demande: { supersets: [{ position: 2, focus: "pull", exercise_count: 2 }], echauffement: false } })
  assertEquals(validerChoix({ supersets: [CHOIX.supersets[1]] }, sans), [])
})

// ── Mise à jour et historique ────────────────────────────────────────────────

Deno.test("planMiseAJour : reprend les supersets de même focus et même taille, quelle que soit la position", () => {
  const plan = planMiseAJour(SEANCE, {
    intensity: "soutenue",
    supersets: [
      { focus: "core_stability", exercise_count: 3, rounds: 5 },
      { focus: "pull", exercise_count: 2, rounds: 3 },
      { focus: "pull", exercise_count: 3, rounds: 2 },
      { focus: "posterior", exercise_count: 3, rounds: 1 },
    ],
  })
  assertEquals(plan.gardes.map((g) => g?.focus ?? null), ["core_stability", null, "pull", "posterior"])
  assertEquals(plan.gardes[0]?.rounds, 5)
  assertEquals(slugsOf(plan.gardes[2]?.exercises ?? []), ["tractions_assistees", "tirage_vertical_genoux", "curl_biceps"])
  assertEquals(plan.aGenerer, [{ position: 2, focus: "pull", exercise_count: 2 }])
  // Mêmes groupes (haut, tronc, jambes) : échauffement gardé.
  assertEquals(plan.echauffementGarde?.warmup, [{ slug: "cercles_hanche", reps: 8 }])
})

Deno.test("planMiseAJour : groupes changés, échauffement à régénérer", () => {
  const plan = planMiseAJour(SEANCE, { intensity: "legere", supersets: [{ focus: "pull", exercise_count: 3, rounds: 3 }] })
  assertEquals(plan.aGenerer, [])
  assertEquals(plan.echauffementGarde, null)
})

Deno.test("exercicesRecents : dernière séance sur le thème, sinon sur le groupe", () => {
  const sessions: DoneSession[] = [
    { completed_at: "2026-10-01T10:00:00+00:00", content: { blocks: [superset("quads", "squat_bulgare", "fente_arriere")] } },
    { completed_at: "2026-10-10T10:00:00+00:00", content: { blocks: [superset("legs", "step_up", "squat_saute")] } },
    { completed_at: "2026-10-05T10:00:00+00:00", content: { blocks: [superset("quads", "squat_elastique", "squat_unipodal_chaise")] } },
  ]
  assertEquals(exercicesRecents("quads", sessions), ["squat_elastique", "squat_unipodal_chaise"])
  assertEquals(exercicesRecents("posterior", sessions), ["step_up", "squat_saute"])
  assertEquals(exercicesRecents("pull", sessions), [])
})

Deno.test("assembler : supersets gardés et échauffement gardé, sans choix du modèle", () => {
  const plan = planMiseAJour(SEANCE, compositionDe(SEANCE))
  const content = assembler({
    composition: compositionDe(SEANCE), choix: null, gardes: plan.gardes,
    echauffementGarde: plan.echauffementGarde, bases: {}, bandsKg: BANDS,
  })
  assertEquals(content.blocks, SEANCE.blocks)
  assertStringIncludes(content.title, "Corps complet")
})
