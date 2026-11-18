// Tests des séances composées (lot R1). Exécution : deno test compose_test.ts
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1"
import { availableExercises, EXERCISE_INDEX } from "./catalog.ts"
import {
  ajuster, assembler, bandeDuMilieu, type Choix, compositionDe, type Composition, derniereFois, doseDe,
  type DoneSession, estimerComposition, estNouveauFormat, exercicesDuTheme, exercicesRecents, groupesDisponibles,
  groupesTries, intensiteDeduite, maxExercices, planMiseAJour, preremplir, raisonSuggestion, remplacer,
  repartition, sansBande, themePourGroupe, titreSeance, validateComposition, validerChoix,
  assemblerEdition, type BlocEdition, blocDeContenu, doseEnEdition, dosesParSlug, type Edition, editionDe,
  exercicesProposes, validerEdition,
} from "./compose.ts"
import { BETWEEN_BLOCKS_SEC, estimateSessionMinutes, TRANSITION_SEC, workSeconds } from "./estimate.ts"
import { groupOfFocus, type SessionContent, SUPERSET_EXERCISES_MAX, SUPERSET_REST_SEC, type TrisetFocus } from "./rules.ts"

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

const proposes = (e: Edition, bloc: BlocEdition, slug?: string) => exercicesProposes(e, { bloc, slug }, FULL)
const slugsProposes = (e: Edition, bloc: BlocEdition, slug?: string) =>
  proposes(e, bloc, slug).flatMap((s) => slugsOf(s.exercices))

Deno.test("editionDe et blocDeContenu : la séance telle qu'elle est", () => {
  const e = editionDe(SEANCE)
  assertEquals(e.warmup, ["cercles_hanche"])
  assertEquals(e.cooldown, ["posture_enfant"])
  assertEquals(e.supersets.map((s) => [s.focus, s.rounds, s.exercises.length]), [
    ["pull", 3, 3], ["core_stability", 3, 3], ["posterior", 3, 3],
  ])
  assertEquals(blocDeContenu(SEANCE, 0, "cercles_hanche"), "warmup")
  assertEquals(blocDeContenu(SEANCE, 2, "planche"), 1)
  assertEquals(blocDeContenu(SEANCE, 4, "posture_enfant"), "cooldown")
  assertEquals(blocDeContenu(SEANCE, 2, "pompes"), null)
})

Deno.test("exercicesProposes : thème puis autres, sans échauffement ni retour au calme, sans la séance", () => {
  const e = editionDe(SEANCE)
  const sections = proposes(e, 0, "tirage_vertical_genoux")
  assertEquals(sections.map((s) => s.cle), ["theme", "autres"])
  const theme = slugsOf(sections[0].exercices)
  // Barre en haut dans le superset de tirage : mi-hauteur et bas exclus.
  assert(theme.includes("tractions_pronation"))
  assert(theme.includes("rowing_bucheron"))
  assert(!theme.includes("tirage_horizontal") && !theme.includes("rowing_inverse"))
  const tous = slugsProposes(e, 0, "tirage_vertical_genoux")
  // Hors thème : pompes proposées, étirement et échauffement jamais.
  assert(tous.includes("pompes"))
  assert(!tous.some((s) => ["posture_enfant", "pigeon", "cercles_hanche", "balancements_jambe"].includes(s)))
  // Déjà dans la séance : jamais.
  assert(!tous.some((s) => ["tractions_assistees", "planche", "dead_bug", "marche_laterale"].includes(s)))
})

Deno.test("exercicesProposes : deux hauteurs de barre au plus, l'exercice remplacé ne compte pas", () => {
  const e = editionDe(SEANCE)
  // Haut et mi-hauteur déjà pris : rien à barre en bas pour le superset arrière.
  const r = slugsProposes(e, 2, "pont_fessier_unipodal")
  assert(!r.includes("nordic_curl") && !r.includes("kickback_elastique"))
  assert(r.includes("abduction_elastique"))
  // Remplacer le seul exercice à mi-hauteur libère une hauteur.
  const p = slugsProposes(e, 1, "pallof_press")
  assert(p.includes("nordic_curl"))
})

Deno.test("exercicesProposes : ajout dans un superset vide, échauffement et retour au calme", () => {
  const e = editionDe(SEANCE)
  e.supersets.push({ focus: "quads", rounds: 3, exercises: [] })
  const sections = proposes(e, 3)
  assertEquals(sections[0].cle, "theme")
  assert(slugsOf(sections[0].exercices).includes("squat_bulgare"))
  const w = proposes(e, "warmup")
  assertEquals(w.map((s) => s.cle), ["echauffement"])
  assert(slugsOf(w[0].exercices).includes("balancements_jambe"))
  assert(slugsOf(w[0].exercices).includes("releves_pointes"))
  assert(!slugsOf(w[0].exercices).includes("cercles_hanche"))
  // marche_laterale est un extra d'échauffement, mais déjà dans un superset.
  assert(!slugsOf(w[0].exercices).includes("marche_laterale"))
  const c = proposes(e, "cooldown")
  assertEquals(c.map((s) => s.cle), ["retour"])
  assert(slugsOf(c[0].exercices).every((s) => EXERCISE_INDEX[s].category === "cooldown"))
})

const EDITION: Edition = {
  warmup: ["cercles_hanche", "balancements_jambe", "ecartes_elastique"],
  supersets: [
    { focus: "pull", rounds: 4, exercises: ["tractions_assistees", { slug: "rowing_bucheron", remplace: "tirage_vertical_genoux" }] },
    { focus: "core_stability", rounds: 3, exercises: ["pallof_press", "planche", "dead_bug"] },
  ],
  cooldown: ["posture_enfant"],
}

Deno.test("validerEdition : édition valide, échauffement à 3", () => {
  assertEquals(validerEdition(EDITION, FULL), [])
})

Deno.test("validerEdition : chaque erreur", () => {
  const avec = (fn: (e: Edition) => void) => {
    const e = structuredClone(EDITION)
    fn(e)
    return validerEdition(e, FULL)
  }
  errorsOf(validerEdition(null, FULL), "objet")
  errorsOf(avec((e) => { e.warmup = [] }), "Échauffement : 1 à 3")
  errorsOf(avec((e) => { e.warmup.push("releves_pointes") }), "Échauffement : 1 à 3")
  errorsOf(avec((e) => { e.cooldown = ["pigeon", "posture_enfant", "etirement_mollet_mur", "etirement_flechisseurs"] }), "Retour au calme : 1 à 3")
  errorsOf(avec((e) => { e.supersets = [] }), "1 à 4 supersets")
  errorsOf(avec((e) => { e.supersets[0].focus = "inconnu" as TrisetFocus }), "thème inconnu")
  errorsOf(avec((e) => { e.supersets[0].rounds = 6 }), "1 à 5 tours")
  errorsOf(avec((e) => { e.supersets[0].exercises = ["tractions_assistees"] }), "2 à 4 exercices")
  errorsOf(avec((e) => { e.supersets[1].exercises.push("tractions_assistees") }), "plusieurs fois")
  errorsOf(avec((e) => { e.warmup[0] = "pompes" }), "n'est pas autorisé")
  errorsOf(avec((e) => { e.cooldown[0] = "cercles_hanche" }), "n'est pas autorisé")
  errorsOf(avec((e) => { e.supersets[1].exercises[2] = "pigeon" }), "n'est pas autorisé")
  errorsOf(avec((e) => { e.supersets[1].exercises[2] = "inconnu" }), "exercice inconnu")
  errorsOf(avec((e) => { e.supersets[0].exercises.push("tirage_horizontal") }), "une seule par superset")
  errorsOf(avec((e) => { e.supersets[1].exercises[2] = "nordic_curl" }), "deux au plus par séance")
  errorsOf(validerEdition(EDITION, NOTHING), "matériel indisponible")
})

Deno.test("assemblerEdition : doses gardées, nouvelles par doseDe avec l'élastique remplacé", () => {
  const c = assemblerEdition(SEANCE, EDITION, { bases: { balancements_jambe: { reps: 14 } }, bandsKg: BANDS })
  assertEquals(c.title, "Haut du corps et tronc")
  assertEquals(c.intensity, "legere")
  assertEquals(c.estimated_min, estimateSessionMinutes(c))
  const [warmup, s1, s2, cooldown] = c.blocks
  assert(warmup.type === "warmup" && cooldown.type === "cooldown")
  assertEquals(warmup.items[0], { slug: "cercles_hanche", reps: 8 })
  assertEquals(warmup.items[1], { slug: "balancements_jambe", reps: 14 })
  // Échauffement sans base : élastique du milieu.
  assertEquals(warmup.items[2], { slug: "ecartes_elastique", reps: 15, band_kg: 15 })
  assert(s1.type === "superset" && s2.type === "superset")
  assertEquals(s1.rounds, 4)
  assertEquals(s1.rest_sec, SUPERSET_REST_SEC)
  assertEquals(s1.exercises?.[0], { slug: "tractions_assistees", reps: 8, band_kg: 30 })
  // Remplace tirage_vertical_genoux (20 kg) : son élastique est repris.
  assertEquals(s1.exercises?.[1], { slug: "rowing_bucheron", reps: 12, band_kg: 20 })
  assertEquals(slugsOf(s2.exercises ?? []), ["pallof_press", "planche", "dead_bug"])
  assertEquals(doseEnEdition("planche", null, { anciennes: dosesParSlug(SEANCE), bases: {}, bandsKg: BANDS }), {
    slug: "planche", duration_sec: 45,
  })
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

// ── Écran de composition (lot R2) ────────────────────────────────────────────

Deno.test("groupesDisponibles : ordre de la feuille, groupe sans thème retiré", () => {
  assertEquals(groupesDisponibles(FULL), ["jambes", "haut", "tronc"])
  // Sans matériel, le haut garde Poussée (pompes) : les trois restent.
  assertEquals(groupesDisponibles(NOTHING), ["jambes", "haut", "tronc"])
  const tronc = NOTHING.filter((e) => e.category === "core")
  assertEquals(groupesDisponibles(tronc), ["tronc"])
  // L'équilibre ouvre aussi Pied et mollet, côté jambes.
  assertEquals(groupesDisponibles(NOTHING.filter((e) => e.category === "balance")), ["jambes", "tronc"])
  assertEquals(groupesDisponibles([]), [])
})

Deno.test("themePourGroupe : thème le plus ancien non utilisé, sinon le plus ancien", () => {
  const sessions = [done("2026-10-10", "legs"), done("2026-10-12", "quads"), done("2026-10-14", "posterior"), done("2026-10-16", "foot_calf")]
  assertEquals(themePourGroupe("jambes", [], sessions, FULL), "legs")
  assertEquals(themePourGroupe("jambes", [{ focus: "legs" }], sessions, FULL), "quads")
  // Tous pris : le plus ancien.
  const tous = ["legs", "quads", "posterior", "foot_calf"].map((focus) => ({ focus: focus as "legs" }))
  assertEquals(themePourGroupe("jambes", tous, sessions, FULL), "legs")
  // Jamais travaillé d'abord.
  assertEquals(themePourGroupe("haut", [], [done("2026-10-20", "pull")], FULL), "push")
  assertEquals(themePourGroupe("haut", [], [], []), null)
})

Deno.test("maxExercices : borne du superset ou exercices du thème", () => {
  assertEquals(maxExercices("quads", FULL), SUPERSET_EXERCISES_MAX)
  // Sans matériel, Poussée n'a que pompes et pompes piquées.
  assertEquals(maxExercices("push", NOTHING), 2)
})

Deno.test("intensiteDeduite : 1 et 2 légère, 3 normale, 4 soutenue", () => {
  assertEquals([1, 2, 3, 4].map(intensiteDeduite), ["legere", "legere", "normale", "soutenue"])
})

Deno.test("estimerComposition : formule par thème, échauffement, retour au calme et pauses", () => {
  assertEquals(estimerComposition({ supersets: [] }, FULL, { bases: {}, bandsKg: BANDS }), null)
  const avail = FULL
  const moyenne = (list: typeof avail) =>
    list.reduce((sum, e) => sum + workSeconds(doseDe(e, { bandsKg: BANDS })), 0) / list.length
  const quads = moyenne(exercicesDuTheme("quads", avail))
  const trunk = moyenne(exercicesDuTheme("trunk", avail))
  const liste = (cat: string) => 2 * moyenne(avail.filter((e) => e.category === cat)) + TRANSITION_SEC
  const attendu = (3 * (3 * quads + 2 * TRANSITION_SEC) + 2 * SUPERSET_REST_SEC) +
    (2 * (2 * trunk + TRANSITION_SEC) + SUPERSET_REST_SEC) +
    liste("warmup") + liste("cooldown") + 3 * BETWEEN_BLOCKS_SEC
  const composition = {
    supersets: [{ focus: "quads" as const, exercise_count: 3, rounds: 3 }, { focus: "trunk" as const, exercise_count: 2, rounds: 2 }],
  }
  assertEquals(estimerComposition(composition, avail, { bases: {}, bandsKg: BANDS }), Math.round(attendu / 60))
})

Deno.test("estimerComposition : la base remplace la référence", () => {
  const composition = { supersets: [{ focus: "quads" as const, exercise_count: 3, rounds: 3 }] }
  const sans = estimerComposition(composition, FULL, { bases: {}, bandsKg: BANDS })!
  const bases = Object.fromEntries(exercicesDuTheme("quads", FULL).map((e) => [e.slug, { reps: 30 }]))
  const avec = estimerComposition(composition, FULL, { bases, bandsKg: BANDS })!
  assert(avec > sans, `${avec} > ${sans}`)
})

Deno.test("raisonSuggestion : groupes dans l'ordre, date la plus récente parmi eux", () => {
  const sessions = [done("2026-10-20", "quads", "trunk"), done("2026-10-24", "pull"), done("2026-10-18", "legs")]
  const c = { supersets: [{ focus: "legs" as const }, { focus: "foot_calf" as const }, { focus: "core_stability" as const }] }
  assertEquals(raisonSuggestion(c, sessions), { groupes: ["jambes", "tronc"], depuis: "2026-10-20T18:00:00+00:00" })
  // Un groupe jamais travaillé : la date des autres reste.
  assertEquals(raisonSuggestion({ supersets: [{ focus: "pull" as const }, { focus: "trunk" as const }] }, [done("2026-10-20", "trunk")]),
    { groupes: ["haut", "tronc"], depuis: "2026-10-20T18:00:00+00:00" })
  assertEquals(raisonSuggestion(c, []), { groupes: ["jambes", "tronc"], depuis: null })
})

// ── Élastiques joués ─────────────────────────────────────────────────────────

Deno.test("sansBande : retire l'exercice, null quand plus rien ne reste", () => {
  assertEquals(sansBande({ face_pull: 15, curl_biceps: 10 }, "face_pull"), { curl_biceps: 10 })
  assertEquals(sansBande({ face_pull: 15 }, "face_pull"), null)
  assertEquals(sansBande({ face_pull: 15 }, "pompes"), { face_pull: 15 })
  assertEquals(sansBande(null, "face_pull"), null)
  assertEquals(sansBande({}, "face_pull"), null)
  assertEquals(sansBande([15], "face_pull"), null)
})
