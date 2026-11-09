import { assertEquals } from "jsr:@std/assert"
import { CHEMIN_RETOUR_DEFAUT, cheminRetour, estCheminInterne, urlRetour } from "./retour.ts"

Deno.test("estCheminInterne : chemins acceptés", () => {
  for (const c of ["/", "/compte", "/training/settings", "/compte/sources?onglet=1", "/a-b_c.d~e", "/x#fin", "/" + "a".repeat(199)]) {
    assertEquals(estCheminInterne(c), true, c)
  }
})

Deno.test("estCheminInterne : chemins refusés", () => {
  const refuses: unknown[] = [
    undefined, null, 42, {}, "",
    "compte", "//evil.com", "///evil.com", "/a//b", "/\\evil.com", "\\evil.com", "/a\\b",
    "https://evil.com", "javascript:alert(1)", "mailto:a@b.c",
    "/a\nb", "/a\rb", "/a\tb", "/a\u0000b", "/a\u007fb",
    "/" + "a".repeat(200),
  ]
  for (const c of refuses) assertEquals(estCheminInterne(c), false, String(c))
})

Deno.test("cheminRetour : défaut et repli", () => {
  assertEquals(cheminRetour(undefined), CHEMIN_RETOUR_DEFAUT)
  assertEquals(cheminRetour("//evil.com"), CHEMIN_RETOUR_DEFAUT)
  assertEquals(cheminRetour("/compte"), "/compte")
})

Deno.test("urlRetour : sans query existante", () => {
  assertEquals(urlRetour("/compte", "ok"), "https://alexispcd.github.io/compte?coros=ok")
  assertEquals(urlRetour(null, "error"), "https://alexispcd.github.io/training/settings?coros=error")
})

Deno.test("urlRetour : avec query existante", () => {
  assertEquals(urlRetour("/compte?onglet=sources", "ok"), "https://alexispcd.github.io/compte?onglet=sources&coros=ok")
  assertEquals(urlRetour("/compte?coros=error", "ok"), "https://alexispcd.github.io/compte?coros=ok")
})

Deno.test("urlRetour : fragment gardé après la query", () => {
  assertEquals(urlRetour("/compte#bas", "ok"), "https://alexispcd.github.io/compte?coros=ok#bas")
})

Deno.test("urlRetour : chemin refusé, retour par défaut", () => {
  assertEquals(urlRetour("//evil.com/x", "ok"), "https://alexispcd.github.io/training/settings?coros=ok")
})
