// Tests du mapping session_steps vers le contenu de séance Coros.
// Lancement : deno test --allow-all supabase/functions/_shared/training/

import { assert, assertEquals, assertThrows } from "jsr:@std/assert"
import {
  buildCorosCourse,
  buildCourseDescription,
  buildCourseName,
  buildSections,
  type CorosGroup,
  type CorosSection,
  CorosCourseError,
} from "./coros-course.ts"
import { expandSteps } from "./expand.ts"
import type { CompactStep, PlanStep } from "./types.ts"

const step = (order: number, p: Partial<PlanStep>): PlanStep => ({
  order_index: order,
  step_type: "run",
  repeat_group: null,
  repeat_index: null,
  target_pace_sec: null,
  pace_tolerance_sec: null,
  distance_m: null,
  duration_sec: null,
  ...p,
})

const NO_DASH = /[\u2013\u2014]/

Deno.test("footing simple : une section effort à la distance avec plage d'allure", () => {
  const course = buildCorosCourse(
    { title: "Footing facile", rationale: "Allure de base pour construire le volume." },
    [step(0, { step_type: "run", distance_m: 8000, target_pace_sec: 330, pace_tolerance_sec: 10 })],
  )
  assertEquals(course, {
    sportType: 1,
    courseName: "Footing facile",
    courseDescription: "Allure de base pour construire le volume. Les allures sont des plages en min/km.",
    sections: [{
      sectionType: 2,
      targetType: 1,
      targetValue: 8000,
      intensityType: 2,
      intensityValueStart: 320,
      intensityValueEnd: 340,
    }],
  })
})

Deno.test("fractionné régulier : échauffement, groupe de répétitions, retour au calme", () => {
  const compact: CompactStep[] = [
    { step_type: "warmup", duration_sec: 900, target_pace_sec: 340 },
    { repeat: 6, interval: { distance_m: 1000, target_pace_sec: 255, pace_tolerance_sec: 5 }, recovery: { duration_sec: 90 } },
    { step_type: "cooldown", duration_sec: 600 },
  ]
  const sections = buildSections(expandSteps(compact))
  assertEquals(sections.length, 3)
  assertEquals(sections[0], {
    sectionType: 1, targetType: 2, targetValue: 900,
    intensityType: 2, intensityValueStart: 335, intensityValueEnd: 345,
  })
  assertEquals(sections[1], {
    intervalGroup: true,
    repeats: 6,
    sets: [
      { sectionType: 2, targetType: 1, targetValue: 1000, intensityType: 2, intensityValueStart: 250, intensityValueEnd: 260 },
      { sectionType: 3, targetType: 2, targetValue: 90 },
    ],
  })
  assertEquals(sections[2], { sectionType: 4, targetType: 2, targetValue: 600 })
})

Deno.test("pyramide : répétitions différentes envoyées dépliées", () => {
  const steps = [
    step(0, { step_type: "interval", repeat_group: 1, repeat_index: 1, distance_m: 400, target_pace_sec: 240 }),
    step(1, { step_type: "recovery", repeat_group: 1, repeat_index: 1, duration_sec: 60 }),
    step(2, { step_type: "interval", repeat_group: 1, repeat_index: 2, distance_m: 800, target_pace_sec: 250 }),
    step(3, { step_type: "recovery", repeat_group: 1, repeat_index: 2, duration_sec: 90 }),
    step(4, { step_type: "interval", repeat_group: 1, repeat_index: 3, distance_m: 400, target_pace_sec: 240 }),
    step(5, { step_type: "recovery", repeat_group: 1, repeat_index: 3, duration_sec: 60 }),
  ]
  const sections = buildSections(steps)
  assertEquals(sections.length, 6)
  assert(sections.every((s) => !("intervalGroup" in s)))
  assertEquals(sections.map((s) => "sectionType" in s ? s.sectionType : 0), [2, 3, 2, 3, 2, 3])
})

Deno.test("plus de 20 répétitions : découpe en groupes consécutifs", () => {
  const steps = expandSteps([
    { repeat: 45, interval: { duration_sec: 30, target_pace_sec: 230 }, recovery: { duration_sec: 30 } },
  ])
  const sections = buildSections(steps) as CorosGroup[]
  assertEquals(sections.map((g) => g.repeats), [20, 20, 5])
  assert(sections.every((g) => g.intervalGroup === true && g.sets.length === 2))
  assert(sections.every((g) => !("targetType" in g) && !("intensityType" in g)))
})

Deno.test("répétition unique : pas de groupe", () => {
  const steps = expandSteps([{ repeat: 1, interval: { distance_m: 2000, target_pace_sec: 270 } }])
  assertEquals(buildSections(steps), [{
    sectionType: 2, targetType: 1, targetValue: 2000,
    intensityType: 2, intensityValueStart: 265, intensityValueEnd: 275,
  }])
})

Deno.test("étape sans allure : aucun champ d'intensité", () => {
  const [s] = buildSections([step(0, { step_type: "recovery", duration_sec: 120, pace_tolerance_sec: 5 })])
  assertEquals(s, { sectionType: 3, targetType: 2, targetValue: 120 })
  assert(!("intensityValueStart" in s))
})

Deno.test("recovery hors groupe : section simple de type 3", () => {
  const [s] = buildSections([step(0, { step_type: "recovery", distance_m: 200 })])
  assertEquals(s, { sectionType: 3, targetType: 1, targetValue: 200 })
})

Deno.test("distance prioritaire sur la durée, valeurs arrondies en entiers", () => {
  const [s] = buildSections([step(0, { distance_m: 1234.6, duration_sec: 300 })])
  assertEquals(s, { sectionType: 2, targetType: 1, targetValue: 1235 })
})

Deno.test("allures bornées à 120 et 1499 s/km", () => {
  const [fast, slow] = buildSections([
    step(0, { distance_m: 200, target_pace_sec: 125, pace_tolerance_sec: 10 }),
    step(1, { duration_sec: 60, target_pace_sec: 1495, pace_tolerance_sec: 10 }),
  ]) as CorosSection[]
  assertEquals([fast.intensityValueStart, fast.intensityValueEnd], [120, 135])
  assertEquals([slow.intensityValueStart, slow.intensityValueEnd], [1485, 1499])
})

Deno.test("étape sans distance ni durée : erreur explicite", () => {
  assertThrows(
    () => buildCorosCourse({ title: "X" }, [step(0, { target_pace_sec: 300 })]),
    CorosCourseError,
    "sans distance ni durée",
  )
  assertThrows(() => buildCorosCourse({ title: "X" }, []), CorosCourseError, "sans étape")
})

Deno.test("textes vides : nom et description de repli non vides", () => {
  assertEquals(buildCourseName(""), "Séance de course")
  assertEquals(buildCourseName(null), "Séance de course")
  assertEquals(buildCourseDescription("   "), "Les allures sont des plages en min/km.")
  assertEquals(buildCourseDescription(null), "Les allures sont des plages en min/km.")
})

Deno.test("textes trop longs ou avec tirets longs : nettoyés et tronqués", () => {
  const name = buildCourseName("Fractionné \u2014 " + "a".repeat(200))
  assertEquals(Array.from(name).length, 100)
  assert(!NO_DASH.test(name))
  assert(name.startsWith("Fractionné, a"))

  const desc = buildCourseDescription("Seuil \u2013 tenir l'allure\n\nsans forcer")
  assertEquals(desc, "Seuil, tenir l'allure sans forcer. Les allures sont des plages en min/km.")
})
