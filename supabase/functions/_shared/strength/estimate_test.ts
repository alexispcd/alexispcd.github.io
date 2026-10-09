// Tests de l'estimation de durée Renfo. Exécution : deno test estimate_test.ts
import { assertEquals } from "jsr:@std/assert@1"
import { estimateSessionMinutes, workSeconds } from "./estimate.ts"
import type { SessionContent } from "./rules.ts"

// Séance connue, calculée à la main (voir le détail de chaque bloc).
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

Deno.test("estimateSessionMinutes : séance connue calculée à la main", () => {
  // 161 + 726 + 393 + 666 + 260 = 2206 s, + 4 × 60 s entre blocs = 2446 s, soit 40,8 min
  assertEquals(estimateSessionMinutes(session), 41)
})
