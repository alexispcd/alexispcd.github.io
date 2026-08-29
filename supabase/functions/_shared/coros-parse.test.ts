// Tests des parseurs de sorties textuelles Coros, sur donnees figees, sans reseau.
//
// Les donnees de test reproduisent des sorties reelles du serveur Coros. Elles
// contiennent donc des tirets cadratins : c'est une entree externe reproduite a
// l'identique, pas du texte redige pour le projet.
//
// Lancer : deno test supabase/functions/_shared/coros-parse.test.ts

import { assertEquals, assertStringIncludes, assertThrows } from "jsr:@std/assert"
import { parseFitnessOverview, parseSportRecords } from "./coros-parse.ts"

// ── Sorties reelles ──────────────────────────────────────────────────────────

const FITNESS_TEXT = `Fitness Assessment Overview
========================

VO2max: 58
Running Level: 85
Threshold Pace: 4:27 /km
5 km Prediction: 21:17
10 km Prediction: 44:06
Half Marathon Prediction: 1:39:02
Marathon Prediction: 3:30:58`

const RECORDS_TEXT = `Sport Records — 2026-08-01 to 2026-08-29 (6 records)
========================

1. Outdoor Run — 2026-08-27
   Location: Course
   Start Coordinates: 47.652000, -2.781000
   Time Window: startTimestamp=1787807049 | endTimestamp=1787811368
   Duration: 57:37 | Distance: 10.85 km
   Average Pace: 5:19 /km | Avg HR: 161 bpm | Calories: 800 kcal
   LabelId: 479911963915223339 | SportType: 100

2. Outdoor Run — 2026-08-25
   Location: Endurance fondamentale
   Start Coordinates: 47.652000, -2.781000
   Time Window: startTimestamp=1787633913 | endTimestamp=1787637783
   Duration: 1:04:21 | Distance: 11.28 km
   Average Pace: 5:42 /km | Avg HR: 153 bpm | Calories: 812 kcal
   LabelId: 479865368622432358 | SportType: 100

3. Outdoor Run — 2026-08-23
   Location: Sortie longue avec portion sp
   Start Coordinates: 47.652000, -2.782000
   Time Window: startTimestamp=1787498042 | endTimestamp=1787502958
   Duration: 1:21:28 | Distance: 16.03 km
   Average Pace: 5:05 /km | Avg HR: 163 bpm | Calories: 1163 kcal
   LabelId: 479829177346850916 | SportType: 100

4. Outdoor Run — 2026-08-08
   Location: Sortie longue avec finition al
   Start Coordinates: 47.651001, -2.782000
   Time Window: startTimestamp=1786175719 | endTimestamp=1786181307
   Duration: 1:31:36 | Distance: 17.06 km
   Average Pace: 5:22 /km | Avg HR: 159 bpm | Calories: 1241 kcal
   LabelId: 479474404995137736 | SportType: 100

5. Outdoor Run — 2026-08-05
   Location: Tempo seuil long 2x3000m
   Start Coordinates: 47.652000, -2.781000
   Time Window: startTimestamp=1785906180 | endTimestamp=1785909498
   Duration: 55:16 | Distance: 11.04 km
   Average Pace: 5:00 /km | Avg HR: 167 bpm | Calories: 819 kcal
   LabelId: 479401452830228587 | SportType: 100

6. Outdoor Run — 2026-08-03
   Location: Sortie facile endurance
   Start Coordinates: 47.652000, -2.782000
   Time Window: startTimestamp=1785733211 | endTimestamp=1785737090
   Duration: 1:04:39 | Distance: 11.26 km
   Average Pace: 5:45 /km | Avg HR: 153 bpm | Calories: 799 kcal
   LabelId: 479355154422857931 | SportType: 100`

// ── parseSportRecords ────────────────────────────────────────────────────────

Deno.test("parseSportRecords : six enregistrements, premier et dernier champ a champ", () => {
  const records = parseSportRecords(RECORDS_TEXT)
  assertEquals(records.length, 6)

  assertEquals(records[0], {
    labelId: "479911963915223339",
    date: "2026-08-27",
    startTimestamp: 1787807049000,
    sport_type: 100,
    distance_m: 10850,
    duration_sec: 3457,
    avg_hr: 161,
  })

  assertEquals(records[5], {
    labelId: "479355154422857931",
    date: "2026-08-03",
    startTimestamp: 1785733211000,
    sport_type: 100,
    distance_m: 11260,
    duration_sec: 3879,
    avg_hr: 153,
  })
})

Deno.test("parseSportRecords : startTimestamp converti en millisecondes", () => {
  // Sans la multiplication par 1000 la seance atterrit en 1970, silencieusement.
  const [first] = parseSportRecords(RECORDS_TEXT)
  assertEquals(first.startTimestamp, 1787807049000)
  assertEquals(first.startTimestamp === 1787807049, false)
  assertEquals(new Date(first.startTimestamp!).getUTCFullYear(), 2026)
})

Deno.test("parseSportRecords : duree mm:ss", () => {
  assertEquals(parseSportRecords(RECORDS_TEXT)[0].duration_sec, 3457)
})

Deno.test("parseSportRecords : duree h:mm:ss", () => {
  assertEquals(parseSportRecords(RECORDS_TEXT)[1].duration_sec, 3861)
})

Deno.test("parseSportRecords : distance en kilometres convertie en metres", () => {
  const records = parseSportRecords(RECORDS_TEXT)
  assertEquals(records[0].distance_m, 10850)
  assertEquals(records[2].distance_m, 16030)
})

Deno.test("parseSportRecords : Avg HR absent donne null sans lever d'erreur", () => {
  const withoutHr = RECORDS_TEXT.replace(
    "Average Pace: 5:19 /km | Avg HR: 161 bpm | Calories: 800 kcal",
    "Average Pace: 5:19 /km | Calories: 800 kcal",
  )
  const records = parseSportRecords(withoutHr)
  assertEquals(records.length, 6)
  assertEquals(records[0].avg_hr, null)
  // Les autres champs restent intacts.
  assertEquals(records[0].distance_m, 10850)
  assertEquals(records[1].avg_hr, 153)
})

Deno.test("parseSportRecords : ligne LabelId manquante leve une Error nommant le champ", () => {
  const amputated = RECORDS_TEXT.replace("   LabelId: 479911963915223339 | SportType: 100\n", "")
  const err = assertThrows(() => parseSportRecords(amputated), Error)
  assertStringIncludes(err.message, "labelId")
})

Deno.test("parseSportRecords : zero enregistrement annonce donne un tableau vide", () => {
  const empty = `Sport Records — 2026-08-01 to 2026-08-02 (0 records)
========================`
  assertEquals(parseSportRecords(empty), [])
})

Deno.test("parseSportRecords : format illisible leve une Error, il n'est pas confondu avec zero resultat", () => {
  assertThrows(() => parseSportRecords("Service temporarily unavailable, retry later."), Error)
})

// ── parseFitnessOverview ─────────────────────────────────────────────────────

Deno.test("parseFitnessOverview : sortie reelle, tous les champs", () => {
  assertEquals(parseFitnessOverview(FITNESS_TEXT), {
    vo2max: 58,
    running_level: "85",
    threshold_pace: "4:27 /km",
    predictions: {
      five_k: "21:17",
      ten_k: "44:06",
      half: "1:39:02",
      marathon: "3:30:58",
    },
  })
})

Deno.test("parseFitnessOverview : Half Marathon n'est pas capture par Marathon", () => {
  const parsed = parseFitnessOverview(FITNESS_TEXT)
  assertEquals(parsed.predictions.half, "1:39:02")
  assertEquals(parsed.predictions.marathon, "3:30:58")
})

Deno.test("parseFitnessOverview : VO2max manquant leve une Error nommant le champ", () => {
  const amputated = FITNESS_TEXT.replace("VO2max: 58\n", "")
  const err = assertThrows(() => parseFitnessOverview(amputated), Error)
  assertStringIncludes(err.message, "vo2max")
})
