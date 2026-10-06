// Tests des parseurs de réponses Coros utilisés par la synchronisation.
// Lancement : deno test --allow-all supabase/functions/_shared/training/

import { assertEquals } from "jsr:@std/assert"
import { parseEditable, parseIdInPlan, toCorosDate } from "./coros-sync.ts"

Deno.test("parseIdInPlan : prose Coros", () => {
  assertEquals(parseIdInPlan("2026-10-06\nEndurance fondamentale\nidInPlan: 25\nDistance: 7.71 km"), "25")
})

Deno.test("parseIdInPlan : entier 64 bits en JSON, sans perte de précision", () => {
  assertEquals(parseIdInPlan('{"idInPlan":479244884092567553,"date":"20261008"}'), "479244884092567553")
  assertEquals(parseIdInPlan('{"idInPlan":"479244884092567553"}'), "479244884092567553")
})

Deno.test("parseIdInPlan : absent", () => {
  assertEquals(parseIdInPlan("Workout created."), null)
})

Deno.test("parseEditable : prose, JSON et absence", () => {
  assertEquals(parseEditable("editable: true"), true)
  assertEquals(parseEditable('{"editable":false,"reasons":["completed"]}'), false)
  assertEquals(parseEditable("editable=true"), true)
  assertEquals(parseEditable("aucun indicateur"), null)
})

Deno.test("toCorosDate : yyyy-MM-dd vers yyyyMMdd", () => {
  assertEquals(toCorosDate("2026-10-08"), "20261008")
})
