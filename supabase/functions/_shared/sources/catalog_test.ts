import { assertEquals } from "jsr:@std/assert"
import { getSource, NOM_SOURCE_INCONNUE, nomSource, SOURCES } from "./catalog.ts"

Deno.test("catalogue : Coros seul, toutes capacités", () => {
  assertEquals(SOURCES.map((s) => s.id), ["coros"])
  assertEquals(getSource("coros")?.capacites, { forme: true, activites: true, envoi: true })
  assertEquals(getSource("coros")?.logo, "/sources/coros.png")
})

Deno.test("nomSource : nom connu", () => {
  assertEquals(nomSource("coros"), "Coros")
})

Deno.test("nomSource : id inconnu, nul ou absent", () => {
  assertEquals(nomSource("garmin"), NOM_SOURCE_INCONNUE)
  assertEquals(nomSource(null), NOM_SOURCE_INCONNUE)
  assertEquals(nomSource(undefined), NOM_SOURCE_INCONNUE)
  assertEquals(nomSource(""), NOM_SOURCE_INCONNUE)
  assertEquals(getSource(null), null)
})
