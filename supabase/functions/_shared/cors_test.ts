// Tests des en-têtes CORS.
// Lancement : deno test --allow-all supabase/functions/_shared/cors_test.ts

import { assertEquals } from "jsr:@std/assert"
import { corsHeaders, withCors } from "./cors.ts"

const req = (method: string, origin?: string) =>
  new Request("https://example.test/fn", { method, headers: origin ? { Origin: origin } : {} })

Deno.test("corsHeaders : origine autorisée renvoyée telle quelle", () => {
  const h = corsHeaders(req("POST", "https://alexispcd.github.io"))
  assertEquals(h["Access-Control-Allow-Origin"], "https://alexispcd.github.io")
  assertEquals(h["Vary"], "Origin")
})

Deno.test("corsHeaders : origine inconnue sans Allow-Origin", () => {
  const h = corsHeaders(req("POST", "https://exemple.invalid"))
  assertEquals(h["Access-Control-Allow-Origin"], undefined)
  assertEquals(h["Vary"], "Origin")
})

Deno.test("corsHeaders : requête sans Origin sans Allow-Origin", () => {
  assertEquals(corsHeaders(req("POST"))["Access-Control-Allow-Origin"], undefined)
})

Deno.test("withCors : préflight sans appel du handler", async () => {
  let called = false
  const res = await withCors(() => {
    called = true
    return Promise.resolve(new Response("x"))
  })(req("OPTIONS", "http://localhost:5173"))
  assertEquals(called, false)
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173")
})

Deno.test("withCors : requête sans Origin jamais bloquée", async () => {
  const res = await withCors(() => Promise.resolve(Response.json({ ok: true }, { status: 201 })))(req("POST"))
  assertEquals(res.status, 201)
  assertEquals(await res.json(), { ok: true })
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), null)
  assertEquals(res.headers.get("Content-Type"), "application/json")
})

Deno.test("withCors : redirection aux en-têtes immuables", async () => {
  const res = await withCors(() => Promise.resolve(Response.redirect("https://alexispcd.github.io/", 302)))(
    req("GET", "https://alexispcd.github.io"),
  )
  assertEquals(res.status, 302)
  assertEquals(res.headers.get("Location"), "https://alexispcd.github.io/")
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "https://alexispcd.github.io")
})
