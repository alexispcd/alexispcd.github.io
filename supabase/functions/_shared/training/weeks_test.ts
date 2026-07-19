// Tests des helpers de dates calendaires.
// Lancement : deno test --allow-all supabase/functions/_shared/training/

import { assertEquals, assertNotEquals } from "jsr:@std/assert"
import { addDaysISO, dayOfWeek, mondayOf, sundayOf, todayISO } from "./weeks.ts"

/** Exécute `fn` avec une horloge figée à l'instant `iso`. */
function atInstant<T>(iso: string, fn: () => T): T {
  const RealDate = Date
  const fixed = new RealDate(iso).getTime()
  class FakeDate extends RealDate {
    // deno-lint-ignore no-explicit-any
    constructor(...args: any[]) {
      if (args.length === 0) super(fixed)
      else super(...(args as [number]))
    }
    static override now() {
      return fixed
    }
  }
  globalThis.Date = FakeDate as unknown as DateConstructor
  try {
    return fn()
  } finally {
    globalThis.Date = RealDate
  }
}

/** L'ancienne dérivation, buguée : conservée pour documenter la régression. */
const naiveUtcToday = () => new Date().toISOString().split("T")[0]

Deno.test("todayISO : minuit passé à Paris, la fonction tourne en UTC (heure d'été)", () => {
  // 00h30 à Paris le 19 juillet = 22h30 UTC le 18 : l'ancienne version renvoyait la veille.
  atInstant("2026-07-19T00:30:00+02:00", () => {
    assertEquals(todayISO(), "2026-07-19")
    assertEquals(naiveUtcToday(), "2026-07-18")
    assertNotEquals(todayISO(), naiveUtcToday())
  })
})

Deno.test("todayISO : minuit passé à Paris (heure d'hiver)", () => {
  // 00h30 à Paris le 15 janvier = 23h30 UTC le 14.
  atInstant("2026-01-15T00:30:00+01:00", () => {
    assertEquals(todayISO(), "2026-01-15")
    assertEquals(naiveUtcToday(), "2026-01-14")
  })
})

Deno.test("todayISO : en journée, Paris et UTC coïncident", () => {
  atInstant("2026-07-19T14:00:00+02:00", () => {
    assertEquals(todayISO(), "2026-07-19")
    assertEquals(naiveUtcToday(), "2026-07-19")
  })
})

Deno.test("todayISO : format yyyy-MM-dd strict", () => {
  atInstant("2026-03-05T09:00:00+01:00", () => {
    assertEquals(todayISO(), "2026-03-05")
  })
})

Deno.test("todayISO : combinable avec les helpers calendaires", () => {
  atInstant("2026-07-19T00:30:00+02:00", () => {
    const today = todayISO()
    assertEquals(dayOfWeek(today), 7)          // 19 juillet 2026 = dimanche
    assertEquals(mondayOf(today), "2026-07-13")
    assertEquals(sundayOf(today), "2026-07-19")
    assertEquals(addDaysISO(today, 1), "2026-07-20")
  })
})
