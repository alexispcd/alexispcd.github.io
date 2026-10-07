// Tests des réponses d'erreur.
// Lancement : deno test --allow-all supabase/functions/_shared/http_test.ts

import { assertEquals } from "jsr:@std/assert"
import { errorMessage, internalError } from "./http.ts"

/** Exécute `fn` en capturant les appels à console.error. */
const captureErrors = async (fn: () => Promise<void> | void): Promise<unknown[][]> => {
  const calls: unknown[][] = []
  const original = console.error
  console.error = (...args: unknown[]) => { calls.push(args) }
  try {
    await fn()
  } finally {
    console.error = original
  }
  return calls
}

Deno.test("internalError : 500 générique, sans aucun détail", async () => {
  let res: Response | undefined
  await captureErrors(() => { res = internalError("demo", new Error("secret interne")) })
  assertEquals(res!.status, 500)
  assertEquals(await res!.json(), { error: "Internal server error" })
})

Deno.test("internalError : le message interne part dans les logs avec le préfixe", async () => {
  const calls = await captureErrors(() => { internalError("demo", new Error("duplicate key value")) })
  assertEquals(calls, [["[demo]", "duplicate key value"]])
})

Deno.test("internalError : erreur non Error convertie en texte", async () => {
  const calls = await captureErrors(() => { internalError("demo", { code: 42 }) })
  assertEquals(calls, [["[demo]", "[object Object]"]])
})

Deno.test("errorMessage : Error, chaîne, valeur quelconque", () => {
  assertEquals(errorMessage(new Error("boum")), "boum")
  assertEquals(errorMessage("texte"), "texte")
  assertEquals(errorMessage(12), "12")
})
