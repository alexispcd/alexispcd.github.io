// Enrichissement du contenu renfo, contrôles de durée et finalisation.
//
// L'estimateur et le trim vivent désormais dans ./estimator.ts, source unique
// des deux côtés (backend et frontend). Ce module les réexporte pour ses
// consommateurs et fournit la couche qui dépend du catalogue (exercises.ts) :
// résolution de l'unilatéralité, enrichissement, mollet obligatoire, finalize.

import {
  BLOCK_THEMES, BONUS_THEME, detectBonusKind, EXERCISE_INDEX,
  type ExerciseCategory,
} from "./exercises.ts"
import type { StrengthBlock, StrengthContent, StrengthExercise } from "./types.ts"
import {
  estimateExerciseSeconds, estimateStrengthDuration, MANDATORY_CALF_SLUG,
  REST_BETWEEN_EXERCISES_SEC, REST_BETWEEN_ROUNDS_SEC, trimToTarget, workSeconds,
} from "./estimator.ts"

// Source unique : réexportée telle quelle pour les consommateurs de strength.ts.
export {
  estimateExerciseSeconds, estimateStrengthDuration, MANDATORY_CALF_SLUG,
  REST_BETWEEN_EXERCISES_SEC, REST_BETWEEN_ROUNDS_SEC, trimToTarget, workSeconds,
}

export const DEFAULT_TARGET_MIN = 40

/**
 * Résout l'unilatéralité pour l'estimateur côté serveur. Lu sur l'exercice s'il
 * est enrichi, sinon depuis le catalogue : le backend estime la sortie BRUTE du
 * modèle où le champ `unilateral` est absent. Doit être passé à
 * estimateStrengthDuration et trimToTarget partout ci-dessous, sans quoi les
 * durées serveur seraient silencieusement faussées.
 */
const catalogUnilateral = (ex: StrengthExercise): boolean =>
  typeof ex.unilateral === "boolean"
    ? ex.unilateral
    : EXERCISE_INDEX[ex.slug]?.unilateral ?? false

// ── Bandes de contrôle de durée (voir validate.ts pour la structure) ──────────
// L'estimateur est sensible : on sépare une bande LARGE (soft) sur la base issue
// du modèle, d'une bande ÉTROITE (hard) sur la séance finale après trim.

/** Niveau 2 (SOUPLE) : bande acceptable de la base modèle, avant trim. Hors bande
 *  → retry ciblé, jamais de blocage.
 *
 *  Bande ASYMÉTRIQUE, et c'est voulu : le trim réduit mais ne rallonge JAMAIS.
 *  Une base trop courte est donc irrécupérable et doit déclencher un retry, d'où
 *  une borne basse calée sur RENFO_FINAL_MIN_MIN. Une base trop longue reste
 *  toujours rattrapable par le trim, d'où une borne haute volontairement large. */
export const RENFO_BASE_SOFT_MIN_MIN = 38
export const RENFO_BASE_SOFT_MAX_MIN = 58

/** Niveau 3 (DUR) : bande de la séance FINALE (après finalizeStrengthContent),
 *  pour une cible de 40 min. Simple garde-fou : la règle de sortie accepte tout
 *  de même la séance trimmée si un retry a déjà échoué. */
export const RENFO_FINAL_MIN_MIN = 38
export const RENFO_FINAL_MAX_MIN = 44

// ── Enrichissement ────────────────────────────────────────────────────────────
/**
 * Résout chaque exercice (slug → name / description / category / equipment /
 * unilateral) et pose un thème de bloc déterministe. Les slugs inconnus
 * (rétrocompatibilité) sont laissés tels quels.
 */
export function enrichBlocks(blocks: StrengthBlock[] | undefined | null): StrengthBlock[] {
  return (blocks ?? []).map((b, bi) => {
    const isCircuit = b.rounds != null
    const exercises: StrengthExercise[] = (b.exercises ?? []).map((ex) => {
      const cat = EXERCISE_INDEX[ex.slug]
      if (!cat) return { ...ex }
      const resolved: StrengthExercise = {
        slug: ex.slug,
        reps: ex.reps ?? null,
        duration_sec: ex.duration_sec ?? null,
        name: cat.name,
        description: cat.description,
        category: cat.category,
        equipment: cat.equipment,
        unilateral: cat.unilateral,
      }
      // Bloc historique : on conserve séries et repos portés par l'exercice.
      return isCircuit ? resolved : { ...resolved, sets: ex.sets, rest_sec: ex.rest_sec }
    })

    let theme = b.theme ?? "Bonus"
    if (bi in BLOCK_THEMES) {
      theme = BLOCK_THEMES[bi]
    } else {
      const cats = exercises.map((e) => e.category).filter(Boolean) as ExerciseCategory[]
      const kind = detectBonusKind(cats)
      if (kind) theme = BONUS_THEME[kind]
    }
    return isCircuit ? { theme, rounds: b.rounds, exercises } : { theme, exercises }
  })
}

// ── Mollet excentrique obligatoire ────────────────────────────────────────────
/** Dosage volontairement bas : travail excentrique lent, et coût maîtrisé. */
const MANDATORY_CALF_REPS = 10
/** Index du bloc Force (0-basé), où le mollet excentrique est injecté. */
export const FORCE_BLOCK_INDEX = 1

/**
 * Garantit la présence du mollet excentrique dans le bloc Force.
 *
 * Injecté par le CODE et non par le modèle (RENFO_RULES le lui interdit
 * explicitement) : c'est une prévention systématique, elle ne doit pas dépendre
 * du bon vouloir du modèle. Appelé APRÈS la validation de la sortie modèle,
 * donc la catégorie pied_mollets dans le bloc Force ne heurte jamais le contrôle
 * de catégories de validate.ts.
 */
export function withMandatoryCalf(blocks: StrengthBlock[]): StrengthBlock[] {
  const present = blocks.some((b) => (b.exercises ?? []).some((e) => e.slug === MANDATORY_CALF_SLUG))
  const force = blocks[FORCE_BLOCK_INDEX]
  if (present || !force) return blocks

  const out = blocks.slice()
  out[FORCE_BLOCK_INDEX] = {
    ...force,
    exercises: [...(force.exercises ?? []), { slug: MANDATORY_CALF_SLUG, reps: MANDATORY_CALF_REPS }],
  }
  return out
}

/**
 * Finalise le contenu renfo pour la persistance : injecte le mollet excentrique,
 * enrichit la base complète, la fige sous `base_blocks`, et pose `blocks` = base
 * réduite à la durée par défaut (40 min). Idempotent : recalcule toujours depuis
 * la base, et l'injection est sans effet si le slug est déjà présent.
 */
export function finalizeStrengthContent(
  content: Partial<StrengthContent> | null | undefined,
  target: number = DEFAULT_TARGET_MIN,
): StrengthContent {
  const rawBase = content?.base_blocks ?? content?.blocks ?? []
  const base = enrichBlocks(withMandatoryCalf(rawBase))
  return {
    target_duration_min: target,
    base_blocks: base,
    blocks: trimToTarget(base, target, catalogUnilateral),
  }
}

// ── Contrôles de durée (niveaux 2 et 3) ───────────────────────────────────────

/**
 * Niveau 2 (SOUPLE) sur la base issue du modèle, AVANT trim. Retourne un message
 * de retry chiffré si la durée estimée sort de la bande large, sinon null. Ne
 * bloque JAMAIS : le message sert seulement à guider un unique retry.
 */
export function baseDurationHint(blocks: StrengthBlock[] | undefined | null, tag: string): string | null {
  const est = estimateStrengthDuration(blocks, catalogUnilateral)
  if (est >= RENFO_BASE_SOFT_MIN_MIN && est <= RENFO_BASE_SOFT_MAX_MIN) return null
  const advice = est > RENFO_BASE_SOFT_MAX_MIN
    ? "réduis le nombre d'exercices par bloc"
    : "ajoute un exercice par bloc"
  return `${tag} : durée estimée ${est} min, cible ${DEFAULT_TARGET_MIN} min, ${advice}`
}

/**
 * Niveau 3 (DUR) sur la séance FINALE, après finalizeStrengthContent. Retourne un
 * message si la durée jouée sort de la bande étroite, sinon null. L'appelant loge
 * l'avertissement mais applique la règle de sortie : la séance trimmée est
 * conservée (une séance imparfaite vaut mieux qu'un plan impossible à générer).
 */
export function finalDurationWarning(content: StrengthContent | null | undefined): string | null {
  const est = estimateStrengthDuration(content?.blocks, catalogUnilateral)
  if (est >= RENFO_FINAL_MIN_MIN && est <= RENFO_FINAL_MAX_MIN) return null
  return `séance finale ${est} min hors bande cible (${RENFO_FINAL_MIN_MIN} à ${RENFO_FINAL_MAX_MIN} min)`
}
