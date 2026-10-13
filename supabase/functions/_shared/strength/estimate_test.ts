// Tests de l'estimation de durée Renfo. Exécution : deno test estimate_test.ts
import { assertEquals } from "jsr:@std/assert@1"
import { estimateSessionMinutes, workSeconds } from "./estimate.ts"
import type { SessionContent } from "./rules.ts"

// Ancienne séance (bloc principal et supersets A+B), calculée à la main : toujours estimée.
const session: SessionContent = {
  title: "Corps complet",
  estimated_min: 0,
  blocks: [
    // 8×3×2 = 48, 12×2×2 = 48, 15×3 = 45, + 2 transitions de 10 s : 161 s
    {
      type: "warmup",
      items: [
        { slug: "cercles_hanche", reps: 8 },
        { slug: "balancements_jambe", reps: 12 },
        { slug: "ecartes_elastique", reps: 15, band_kg: 10 },
      ],
    },
    // squat bulgare : 3×60 + 2×90 = 360, + 90 vers l'exercice suivant
    // tractions assistées : 3×32 + 2×90 = 276. Total 726 s
    {
      type: "main",
      items: [
        { slug: "squat_bulgare", sets: 3, reps: 10, rest_sec: 90 },
        { slug: "tractions_assistees", sets: 3, reps: 8, rest_sec: 90, band_kg: 30 },
      ],
    },
    // 3×(45 + 36 + 10) + 2×60 = 393 s
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "planche", duration_sec: 45 },
      b: { slug: "curl_biceps", reps: 12, band_kg: 15 },
    },
    // 3×(100 + 72 + 10) + 2×60 = 666 s
    {
      type: "superset", rounds: 3, rest_sec: 60,
      a: { slug: "mollet_excentrique", reps: 10 },
      b: { slug: "pont_fessier_unipodal", reps: 12 },
    },
    // 3×80 + 2×10 = 260 s
    {
      type: "cooldown",
      items: [
        { slug: "etirement_flechisseurs", duration_sec: 40 },
        { slug: "pigeon", duration_sec: 40 },
        { slug: "etirement_mollet_mur", duration_sec: 40 },
      ],
    },
  ],
}

Deno.test("workSeconds : répétitions, durée, unilatéral doublé", () => {
  assertEquals(workSeconds({ slug: "pompes", reps: 12 }), 36)
  assertEquals(workSeconds({ slug: "planche", duration_sec: 45 }), 45)
  assertEquals(workSeconds({ slug: "mollet_excentrique", reps: 10 }), 100)
  assertEquals(workSeconds({ slug: "planche_laterale", duration_sec: 30 }), 60)
})

Deno.test("estimateSessionMinutes : ancienne séance avec bloc principal, calculée à la main", () => {
  // 161 + 726 + 393 + 666 + 260 = 2206 s, + 4 × 60 s entre blocs = 2446 s, soit 40,8 min
  assertEquals(estimateSessionMinutes(session), 41)
})

Deno.test("estimateSessionMinutes : triset A, B, C, repos après C seulement", () => {
  const triset: SessionContent = {
    title: "Triset",
    estimated_min: 0,
    blocks: [
      // 3×(60 + 36 + 100 + 2×10) + 2×75 = 3×216 + 150 = 798 s
      {
        type: "superset", focus: "legs", rounds: 3, rest_sec: 75,
        a: { slug: "squat_bulgare", reps: 10 },
        b: { slug: "sdt_roumain_elastique", reps: 12, band_kg: 20 },
        c: { slug: "mollet_excentrique", reps: 10 },
      },
      // 3×(45 + 36 + 10) + 2×60 = 393 s, identique à l'ancien calcul A+B
      {
        type: "superset", rounds: 3, rest_sec: 60,
        a: { slug: "planche", duration_sec: 45 },
        b: { slug: "curl_biceps", reps: 12, band_kg: 15 },
      },
    ],
  }
  // 798 + 393 + 60 entre blocs = 1251 s, soit 20,85 min
  assertEquals(estimateSessionMinutes(triset), 21)
  assertEquals(estimateSessionMinutes({ blocks: [triset.blocks[0]] }), 13)
})

Deno.test("estimateSessionMinutes : séance upper en trois trisets, calculée à la main", () => {
  const upper: SessionContent = {
    title: "Haut du corps",
    estimated_min: 0,
    blocks: [
      // 8×3×2 = 48, 15×3 = 45, + 10 de transition : 103 s
      { type: "warmup", items: [{ slug: "cercles_hanche", reps: 8 }, { slug: "ecartes_elastique", reps: 15, band_kg: 10 }] },
      // 3×(32 + 36 + 36 + 2×10) + 2×75 = 522 s
      {
        type: "superset", focus: "pull", rounds: 3, rest_sec: 75,
        a: { slug: "tractions_assistees", reps: 8, band_kg: 30 },
        b: { slug: "tirage_vertical_genoux", reps: 12, band_kg: 20 },
        c: { slug: "curl_biceps", reps: 12, band_kg: 15 },
      },
      // 3×(36 + 36 + 36 + 2×10) + 2×75 = 534 s
      {
        type: "superset", focus: "push", rounds: 3, rest_sec: 75,
        a: { slug: "pompes", reps: 12 },
        b: { slug: "dips_chaise", reps: 12 },
        c: { slug: "extension_triceps_tete", reps: 12, band_kg: 10 },
      },
      // 3×(36 + 36 + 90 + 2×10) + 2×60 = 666 s
      {
        type: "superset", focus: "shoulders_arms", rounds: 3, rest_sec: 60,
        a: { slug: "curl_marteau", reps: 12, band_kg: 15 },
        b: { slug: "developpe_epaules_elastique", reps: 12, band_kg: 15 },
        c: { slug: "rotation_externe", reps: 15, band_kg: 10 },
      },
      // 45 + 40×2 + 10 = 135 s
      { type: "cooldown", items: [{ slug: "posture_enfant", duration_sec: 45 }, { slug: "pigeon", duration_sec: 40 }] },
    ],
  }
  // 103 + 522 + 534 + 666 + 135 = 1960 s, + 4 × 60 s entre blocs = 2200 s, soit 36,7 min
  assertEquals(estimateSessionMinutes(upper), 37)
})
