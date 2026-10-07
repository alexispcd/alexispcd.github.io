// Tests du contrôle d'accès par module.
// Lancement : deno test --allow-all supabase/functions/_shared/access_test.ts

import { assertEquals } from "jsr:@std/assert"
import { hasModule } from "./access.ts"
import { isModuleId } from "./modules.ts"

Deno.test("hasModule : user avec le module", () => {
  assertEquals(hasModule({ role: "user", modules: ["cotes", "training"] }, "training"), true)
})

Deno.test("hasModule : user sans le module", () => {
  assertEquals(hasModule({ role: "user", modules: ["cotes"] }, "training"), false)
})

Deno.test("hasModule : user sans aucun module", () => {
  assertEquals(hasModule({ role: "user", modules: [] }, "cotes"), false)
})

Deno.test("hasModule : admin sans le module, refusé", () => {
  assertEquals(hasModule({ role: "admin", modules: ["cotes"] }, "veille"), false)
  assertEquals(hasModule({ role: "admin", modules: [] }, "training"), false)
})

Deno.test("hasModule : admin avec le module, accepté", () => {
  assertEquals(hasModule({ role: "admin", modules: ["cotes", "veille"] }, "veille"), true)
})

Deno.test("isModuleId : admin n'est jamais attribuable", () => {
  assertEquals(isModuleId("admin"), false)
  assertEquals(isModuleId("training"), true)
  assertEquals(isModuleId(""), false)
  assertEquals(isModuleId(42), false)
})
