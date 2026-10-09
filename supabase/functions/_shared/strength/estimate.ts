// Estimation de la durée d'une séance Renfo. Module pur, aussi importé par le front.

import { EXERCISE_INDEX } from "./catalog.ts"
import type { Dose, SessionBlock } from "./rules.ts"

/** Transition entre deux exercices d'un échauffement, d'un retour au calme ou entre A et B. */
export const TRANSITION_SEC = 10
/** Pause entre deux blocs. */
export const BETWEEN_BLOCKS_SEC = 60

/** Travail d'un exercice en secondes : reps × sec_per_rep ou duration_sec, doublé si unilatéral. */
export function workSeconds(dose: Dose): number {
  const exercise = EXERCISE_INDEX[dose.slug]
  const base = dose.duration_sec ?? (dose.reps ?? 0) * (exercise?.sec_per_rep ?? 0)
  return exercise?.unilateral ? base * 2 : base
}

const listSeconds = (items: Dose[]): number =>
  items.reduce((sum, item) => sum + workSeconds(item), 0) + Math.max(items.length - 1, 0) * TRANSITION_SEC

function blockSeconds(block: SessionBlock): number {
  switch (block.type) {
    case "warmup":
    case "cooldown":
      return listSeconds(block.items)
    case "main":
      // Entre deux exercices : le repos de l'exercice qui se termine.
      return block.items.reduce((sum, item, i) =>
        sum + item.sets * workSeconds(item) + (item.sets - 1) * item.rest_sec +
        (i < block.items.length - 1 ? item.rest_sec : 0), 0)
    case "superset":
      return block.rounds * (workSeconds(block.a) + workSeconds(block.b) + TRANSITION_SEC) +
        (block.rounds - 1) * block.rest_sec
  }
}

/** Durée estimée d'une séance, arrondie à la minute. */
export function estimateSessionMinutes(content: { blocks: SessionBlock[] }): number {
  const blocks = content.blocks ?? []
  const total = blocks.reduce((sum, block) => sum + blockSeconds(block), 0) +
    Math.max(blocks.length - 1, 0) * BETWEEN_BLOCKS_SEC
  return Math.round(total / 60)
}
