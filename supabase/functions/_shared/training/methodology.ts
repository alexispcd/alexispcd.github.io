// Méthodologie de coaching + schéma de sortie JSON, partagés par les prompts de
// génération, régénération et adaptation.

/** Règles de coaching réutilisables (méthodologie + allures + steps + renfo),
 *  sans le schéma de sortie — partagées entre génération et adaptation. */
export const TRAINING_RULES = `MÉTHODOLOGIE
- 3 blocs successifs : construction → intensification → affûtage. L'affûtage occupe les 2-3 dernières semaines (volume réduit, intensité préservée).
- Chaque semaine = exactement 4 séances :
  - Zone A (type "facile") : lundi ou mardi, course facile en endurance.
  - Zone B (type "fractionne" ou "tempo") : mercredi, jeudi ou vendredi, séance de qualité.
  - Zone C (type "sortie_longue") : samedi ou dimanche, sortie longue progressive.
  - Renfo (zone "renfo", type "renfo") : jour flexible, tapis de sol uniquement, orienté course (gainage, fessiers, ischios, proprioception).
- Progression logique de semaine en semaine, jamais deux séances dures consécutives.
- Ne copie pas des séances passées : calibre l'intensité sur les données de forme fournies.

ALLURES (dérivées de la VMA, en secondes/km)
- allure_sec = round(3600 / (VMA_kmh * fraction))
- Facile / sortie longue : fraction 0.65 à 0.72.
- Tempo (allure seuil) : fraction 0.85 à 0.88 — si un threshold_pace_sec est fourni, utilise-le comme base tempo.
- Fractionné (intervalles) : fraction 0.93 à 1.00 selon la longueur (plus court = plus rapide).
- pace_tolerance_sec : ~5 en qualité, ~8-10 en facile/longue.
- Justifie l'allure de chaque séance dans "rationale" (1 phrase).

STEPS (séances de course uniquement)
- Toute séance de course (facile, fractionne, tempo, sortie_longue) contient un tableau "steps" ordonné (order_index à partir de 0), reflétant EXACTEMENT le déroulé de la séance dans l'ordre des laps montre.
- Un step est borné par "distance_m" OU "duration_sec" (au moins l'un des deux). "target_pace_sec" est requis SAUF pour step_type "recovery" (récup en allure libre → target_pace_sec null).
- step_type ∈ warmup | run | interval | recovery | cooldown.
- Fractionné : APLATIS les répétitions. Un step "interval" + un step "recovery" par répétition, avec "repeat_group" (numéro du bloc de répétitions, ex. 1) et "repeat_index" (1..N). Précède d'un "warmup" et termine par un "cooldown".
  Exemple 6x1000m : warmup(order 0), puis pour i de 1 à 6 : interval(distance_m 1000, repeat_group 1, repeat_index i) + recovery(duration_sec, repeat_group 1, repeat_index i), puis cooldown.
- Facile / sortie longue : généralement un seul step "run" (distance_m ou duration_sec + allure).
- Tempo : warmup + un ou plusieurs "run"/"interval" au seuil + cooldown.

RENFO
- La séance renfo n'a AUCUN step. Elle porte "strength_content" :
  { "target_duration_min": number, "blocks": [ { "name": string, "exercises": [ { "name": string, "sets": number, "reps"?: number, "duration_sec"?: number, "rest_sec": number } ] } ] }`

/** System prompt commun (coach + méthodologie + schéma de sortie). */
export function buildPlanSystemPrompt(): string {
  return `Tu es un coach running expert. Tu construis un plan d'entraînement structuré, progressif et calibré sur les capacités réelles de l'athlète.

${TRAINING_RULES}

SORTIE
- Réponds UNIQUEMENT avec le JSON, sans texte avant/après ni bloc markdown. Commence par { et termine par }.
- Schéma exact :
${PLAN_OUTPUT_SCHEMA}`
}

export const PLAN_OUTPUT_SCHEMA = `{
  "summary": "résumé du plan en 2-3 phrases",
  "weeks": [
    {
      "week_number": 1,
      "block": "construction",
      "focus": "objectif de la semaine",
      "target_km": 35,
      "start_date": "2026-07-13",
      "sessions": [
        {
          "scheduled_date": "2026-07-14",
          "zone": "A",
          "type": "facile",
          "title": "Sortie facile",
          "rationale": "endurance fondamentale à 70% VMA",
          "steps": [
            { "order_index": 0, "step_type": "run", "target_pace_sec": 330, "pace_tolerance_sec": 8, "duration_sec": 2700 }
          ]
        },
        {
          "scheduled_date": "2026-07-16",
          "zone": "B",
          "type": "fractionne",
          "title": "6x1000m",
          "rationale": "VMA courte, allure 5-10k",
          "steps": [
            { "order_index": 0, "step_type": "warmup", "target_pace_sec": 360, "pace_tolerance_sec": 10, "duration_sec": 900 },
            { "order_index": 1, "step_type": "interval", "repeat_group": 1, "repeat_index": 1, "target_pace_sec": 250, "pace_tolerance_sec": 5, "distance_m": 1000 },
            { "order_index": 2, "step_type": "recovery", "repeat_group": 1, "repeat_index": 1, "target_pace_sec": null, "duration_sec": 90 },
            { "order_index": 3, "step_type": "interval", "repeat_group": 1, "repeat_index": 2, "target_pace_sec": 250, "pace_tolerance_sec": 5, "distance_m": 1000 },
            { "order_index": 4, "step_type": "recovery", "repeat_group": 1, "repeat_index": 2, "target_pace_sec": null, "duration_sec": 90 },
            { "order_index": 5, "step_type": "cooldown", "target_pace_sec": 360, "pace_tolerance_sec": 10, "duration_sec": 600 }
          ]
        },
        {
          "scheduled_date": "2026-07-19",
          "zone": "C",
          "type": "sortie_longue",
          "title": "Sortie longue",
          "rationale": "volume aérobie",
          "steps": [
            { "order_index": 0, "step_type": "run", "target_pace_sec": 340, "pace_tolerance_sec": 8, "distance_m": 15000 }
          ]
        },
        {
          "scheduled_date": "2026-07-17",
          "zone": "renfo",
          "type": "renfo",
          "title": "Renforcement course",
          "rationale": "gainage et chaîne postérieure",
          "strength_content": {
            "target_duration_min": 30,
            "blocks": [
              { "name": "Gainage", "exercises": [ { "name": "Planche", "sets": 3, "duration_sec": 45, "rest_sec": 30 } ] }
            ]
          }
        }
      ]
    }
  ]
}`

export function buildRetryPrompt(errors: string[]): string {
  return [
    "Le JSON précédent est invalide. Corrige-le en respectant STRICTEMENT le schéma et les règles.",
    "Erreurs détectées :",
    ...errors.slice(0, 25).map((e) => `- ${e}`),
    "",
    "Renvoie le plan complet corrigé, UNIQUEMENT le JSON.",
  ].join("\n")
}
