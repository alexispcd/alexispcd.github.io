import { assertEquals } from "jsr:@std/assert"
import { CHEMIN_RETOUR_DEFAUT, cheminRetour, estCheminInterne, urlRetour } from "./retour.ts"

Deno.test("estCheminInterne : chemins acceptés", () => {
  for (const c of ["/", "/compte", "/compte/sources", "/compte/sources?onglet=1", "/a-b_c.d~e", "/x#fin", "/" + "a".repeat(199)]) {
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

Deno.test("cheminRetour : défaut /compte/sources et repli", () => {
  assertEquals(CHEMIN_RETOUR_DEFAUT, "/compte/sources")
  assertEquals(cheminRetour(undefined), "/compte/sources")
  assertEquals(cheminRetour("//evil.com"), "/compte/sources")
  assertEquals(cheminRetour("/training"), "/training")
})

Deno.test("urlRetour : sans query existante", () => {
  assertEquals(urlRetour("/compte", "coros", "ok"), "https://alexispcd.github.io/compte?source=coros&connexion=ok")
  assertEquals(urlRetour(null, "coros", "echec"), "https://alexispcd.github.io/compte/sources?source=coros&connexion=echec")
})

Deno.test("urlRetour : avec query existante", () => {
  assertEquals(
    urlRetour("/training?view=history", "coros", "ok"),
    "https://alexispcd.github.io/training?view=history&source=coros&connexion=ok",
  )
  assertEquals(
    urlRetour("/compte/sources?connexion=echec&source=coros", "coros", "ok"),
    "https://alexispcd.github.io/compte/sources?connexion=ok&source=coros",
  )
})

Deno.test("urlRetour : fragment gardé après la query", () => {
  assertEquals(urlRetour("/compte#bas", "coros", "ok"), "https://alexispcd.github.io/compte?source=coros&connexion=ok#bas")
})

Deno.test("urlRetour : chemin refusé, retour par défaut", () => {
  assertEquals(urlRetour("//evil.com/x", "coros", "ok"), "https://alexispcd.github.io/compte/sources?source=coros&connexion=ok")
})
