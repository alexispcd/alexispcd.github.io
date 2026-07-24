import type { CompactStep, GeneratedPlan, PlanSession } from "./types.ts"
import { isRepeatBlock } from "./expand.ts"
import { dayOfWeek, dayTs, type WeekBounds, type Zone, zoneRangeForWeek } from "./weeks.ts"
import {
  BLOCK_CATEGORIES, detectBonusKind, EXERCISE_INDEX, type ExerciseCategory, isExerciseSlug,
} from "./exercises.ts"
import { FORCE_BLOCK_INDEX, MANDATORY_CALF_SLUG } from "./strength.ts"

// dayTs reste exposé depuis ce module (importé par d'autres fonctions Edge).
export { dayTs }

const BLOCKS = ["construction", "intensification", "affutage"]
const ZONES = ["A", "B", "C", "renfo"]
const TYPES = ["facile", "fractionne", "tempo", "sortie_longue", "renfo"]
const STEP_TYPES = ["warmup", "run", "interval", "recovery", "cooldown"]

export const isStrengthSession = (s: Pick<PlanSession, "type" | "zone">) =>
  s.type === "renfo" || s.zone === "renfo"

/**
 * Valide le contenu d'une séance (zone, type, title, steps / strength_content).
 * Ne vérifie PAS la date (réutilisable pour l'adaptation où la date ne change pas).
 */
export function validateSessionContent(s: PlanSession, tag: string, errors: string[]): void {
  if (!ZONES.includes(s.zone)) errors.push(`${tag} : zone invalide "${s.zone}"`)
  if (!TYPES.includes(s.type)) errors.push(`${tag} : type invalide "${s.type}"`)
  if (!s.title) errors.push(`${tag} : title manquant`)

  if (isStrengthSession(s)) {
    validateStrengthContent(s.strength_content, tag, errors)
    if (Array.isArray(s.steps) && s.steps.length > 0) {
      errors.push(`${tag} : renfo ne doit pas avoir de steps`)
    }
  } else {
    if (!Array.isArray(s.steps) || s.steps.length === 0) {
      errors.push(`${tag} : séance de course sans steps`)
    } else {
      validateSteps(s, tag, errors)
    }
  }
}

/** Valide le format COMPACT des steps (avant dépliage par expand.ts). */
function validateSteps(s: PlanSession, tag: string, errors: string[]): void {
  const steps = s.steps as CompactStep[]
  let repeatBlocks = 0

  steps.forEach((el, idx) => {
    const stag = `${tag} step ${idx + 1}`

    if (isRepeatBlock(el)) {
      repeatBlocks++
      if (!Number.isInteger(el.repeat) || el.repeat < 2) {
        errors.push(`${stag} : repeat doit être un entier ≥ 2`)
      }
      const iv = el.interval
      if (!iv || typeof iv !== "object") {
        errors.push(`${stag} : interval manquant`)
      } else {
        if (iv.distance_m == null && iv.duration_sec == null) {
          errors.push(`${stag} interval : distance_m ou duration_sec requis`)
        }
        if (iv.target_pace_sec == null) errors.push(`${stag} interval : target_pace_sec requis`)
      }
      if (el.recovery != null) {
        const rc = el.recovery
        if (rc.distance_m == null && rc.duration_sec == null) {
          errors.push(`${stag} recovery : distance_m ou duration_sec requis`)
        }
        // target_pace_sec optionnel sur recovery (récup en allure libre).
      }
    } else {
      if (!STEP_TYPES.includes(el.step_type)) errors.push(`${stag} : step_type invalide "${el.step_type}"`)
      if (el.distance_m == null && el.duration_sec == null) {
        errors.push(`${stag} : distance_m ou duration_sec requis`)
      }
      if (el.step_type !== "recovery" && el.target_pace_sec == null) {
        errors.push(`${stag} : target_pace_sec requis (sauf recovery)`)
      }
    }
  })

  if (s.type === "fractionne" && repeatBlocks === 0) {
    errors.push(`${tag} : fractionné sans bloc de répétitions (champ "repeat" requis)`)
  }
}

// ── Renfo : validation de STRUCTURE (niveau 1, DUR) ───────────────────────────
//
// Ce contrôle porte sur la SORTIE MODÈLE et ne concerne QUE la structure (4 blocs,
// slugs, catégories, reps XOR duration_sec, rounds, nombre d'exercices). La durée
// est traitée à part, en soft (voir baseDurationHint dans strength.ts), parce que
// l'estimateur est sensible : la lier au niveau 1 rejetterait des séances jouables.
//
// Bornes d'exercices : elles décrivent la séance FINALE (3 à 5 par bloc, 12 à 20
// au total), mollet excentrique inclus. Or ce mollet est injecté PAR LE CODE dans
// le bloc Force après la sortie du modèle (strength.ts, withMandatoryCalf) : +1
// exercice dans ce bloc. On valide donc les comptes PROJETÉS (sortie modèle + le
// mollet à venir), pour que le prompt et le validateur parlent de la même séance.
const RENFO_MIN_PER_BLOCK = 3
const RENFO_MAX_PER_BLOCK = 5
const RENFO_MIN_EXERCISES = 12
const RENFO_MAX_EXERCISES = 20
const RENFO_ROUNDS = [2, 3]

/**
 * Valide la STRUCTURE du strength_content d'une séance renfo (sortie modèle) :
 * exactement 4 blocs dans l'ordre, "rounds" à 2 ou 3, slugs du catalogue,
 * catégories cohérentes par bloc, reps XOR duration_sec, et les bornes d'exercices
 * de la séance finale (mollet excentrique injecté par le code pris en compte).
 * NE contrôle PAS la durée (niveau 2 soft, géré par les fonctions Edge).
 */
export function validateStrengthContent(content: unknown, tag: string, errors: string[]): void {
  if (!content || typeof content !== "object") {
    errors.push(`${tag} : renfo sans strength_content`)
    return
  }
  const blocks = (content as { blocks?: unknown }).blocks
  if (!Array.isArray(blocks) || blocks.length !== 4) {
    errors.push(`${tag} : renfo doit avoir EXACTEMENT 4 blocs (échauffement, force, gainage, bonus)`)
    return
  }

  // Le mollet excentrique n'est ajouté au bloc Force que s'il n'est pas déjà là
  // (miroir de withMandatoryCalf). On projette les comptes en conséquence.
  const calfPresent = blocks.some((bU) =>
    Array.isArray((bU as { exercises?: unknown }).exercises) &&
    ((bU as { exercises: Array<{ slug?: unknown }> }).exercises).some((e) => e?.slug === MANDATORY_CALF_SLUG))

  let projectedTotal = 0
  blocks.forEach((bU, bi) => {
    const btag = `${tag} bloc ${bi + 1}`
    const exos = (bU as { exercises?: unknown }).exercises
    if (!Array.isArray(exos) || exos.length === 0) {
      errors.push(`${btag} : aucun exercice`)
      return
    }
    // Compte projeté du bloc : +1 sur le bloc Force pour le mollet à injecter.
    const injected = bi === FORCE_BLOCK_INDEX && !calfPresent ? 1 : 0
    const projected = exos.length + injected
    projectedTotal += projected
    if (projected < RENFO_MIN_PER_BLOCK || projected > RENFO_MAX_PER_BLOCK) {
      const suffix = injected ? " (mollet excentrique du code inclus)" : ""
      errors.push(`${btag} : ${projected} exercices${suffix} (attendu ${RENFO_MIN_PER_BLOCK} à ${RENFO_MAX_PER_BLOCK} par bloc)`)
    }

    const rounds = (bU as { rounds?: unknown }).rounds
    if (!RENFO_ROUNDS.includes(rounds as number)) {
      errors.push(`${btag} : "rounds" doit valoir ${RENFO_ROUNDS.join(" ou ")} (nombre de tours du circuit)`)
    }

    const cats: ExerciseCategory[] = []
    exos.forEach((exU, ei) => {
      const etag = `${btag} exercice ${ei + 1}`
      const ex = exU as Record<string, unknown>
      if (!isExerciseSlug(ex.slug)) {
        errors.push(`${etag} : slug inconnu "${String(ex.slug)}" (hors catalogue)`)
        return
      }
      const cat = EXERCISE_INDEX[ex.slug]
      cats.push(cat.category)

      const hasReps = ex.reps != null
      const hasDur = ex.duration_sec != null
      if (hasReps === hasDur) {
        errors.push(`${etag} (${ex.slug}) : renseigne "reps" OU "duration_sec" (exactement un des deux)`)
      } else if (cat.mode === "reps" && !hasReps) {
        errors.push(`${etag} (${ex.slug}) : exercice en mode reps, "reps" attendu`)
      } else if (cat.mode === "duration" && !hasDur) {
        errors.push(`${etag} (${ex.slug}) : exercice en mode duration, "duration_sec" attendu`)
      }
      if (hasReps && (typeof ex.reps !== "number" || (ex.reps as number) <= 0)) {
        errors.push(`${etag} (${ex.slug}) : reps invalide`)
      }
      if (hasDur && (typeof ex.duration_sec !== "number" || (ex.duration_sec as number) <= 0)) {
        errors.push(`${etag} (${ex.slug}) : duration_sec invalide`)
      }
    })

    // Catégories autorisées par position ; bonus (bloc 4) = un seul thème cohérent.
    if (bi < 3) {
      const allowed = BLOCK_CATEGORIES[bi]
      const bad = [...new Set(cats.filter((c) => !allowed.includes(c)))]
      if (bad.length) {
        errors.push(`${btag} : catégorie(s) ${bad.join(", ")} interdite(s) ici (attendu : ${allowed.join(" / ")})`)
      }
    } else if (detectBonusKind(cats) == null) {
      errors.push(`${btag} (bonus) : mélange interdit, choisis proprioception/pied_mollets OU haut_corps`)
    }
  })

  if (projectedTotal < RENFO_MIN_EXERCISES || projectedTotal > RENFO_MAX_EXERCISES) {
    errors.push(`${tag} : ${projectedTotal} exercices au total, mollet du code inclus (attendu ${RENFO_MIN_EXERCISES} à ${RENFO_MAX_EXERCISES})`)
  }
}

/**
 * Valide un plan (ou un sous-ensemble de semaines) renvoyé par le modèle contre
 * le schéma BDD et les règles métier. `firstWeek` = numéro de la première semaine
 * attendue (1 pour une génération complète, semaine courante pour une régénération).
 *
 * `boundsByWeek` (optionnel) : bornes calendaires lundi→dimanche par week_number.
 * Fourni → on valide en plus que chaque semaine est bien bornée (start = borne de
 * début de la semaine) et que la scheduled_date de chaque séance tombe dans la
 * plage de sa zone (renfo : dans la semaine). Voir _shared/training/weeks.ts.
 *
 * Retourne la liste des erreurs (vide si valide).
 */
export function validatePlan(
  plan: GeneratedPlan,
  todayStr: string,
  raceDateStr: string,
  firstWeek = 1,
  boundsByWeek?: Map<number, WeekBounds>,
): string[] {
  const errors: string[] = []
  const lo = dayTs(todayStr)
  const hi = dayTs(raceDateStr)

  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
    errors.push("weeks doit être un tableau non vide")
    return errors
  }

  const sorted = [...plan.weeks].sort((a, b) => (a.week_number ?? 0) - (b.week_number ?? 0))
  sorted.forEach((w, i) => {
    const expected = firstWeek + i
    const wn = w.week_number
    if (wn !== expected) errors.push(`week_number non continu : attendu ${expected}, reçu ${wn}`)
    if (!BLOCKS.includes(w.block)) errors.push(`semaine ${wn} : block invalide "${w.block}"`)

    const bounds = boundsByWeek?.get(wn)
    if (bounds) {
      // Bornes calendaires : start attendu = début de la semaine (lundi hors S1).
      if (w.start_date != null && w.start_date !== bounds.start) {
        errors.push(`semaine ${wn} : start_date ${w.start_date} attendu ${bounds.start} (semaine lundi→dimanche)`)
      }
    } else if (w.start_date != null) {
      const ts = dayTs(w.start_date)
      if (Number.isNaN(ts)) errors.push(`semaine ${wn} : start_date invalide "${w.start_date}"`)
      else if (ts < lo || ts > hi) errors.push(`semaine ${wn} : start_date ${w.start_date} hors [${todayStr}, ${raceDateStr}]`)
    }

    if (!Array.isArray(w.sessions) || w.sessions.length === 0) {
      errors.push(`semaine ${wn} : aucune séance`)
      return
    }

    w.sessions.forEach((s, si) => {
      const tag = `semaine ${wn} séance ${si + 1}`
      const ts = dayTs(s.scheduled_date)
      if (Number.isNaN(ts)) errors.push(`${tag} : scheduled_date invalide "${s.scheduled_date}"`)
      else if (ts < lo || ts > hi) errors.push(`${tag} : scheduled_date ${s.scheduled_date} hors [${todayStr}, ${raceDateStr}]`)
      else if (bounds && (s.zone === "A" || s.zone === "B" || s.zone === "C" || s.zone === "renfo")) {
        validateSessionPlacement(s.zone as Zone, s.scheduled_date, bounds, wn, tag, errors)
      }
      validateSessionContent(s, tag, errors)
    })
  })

  return errors
}

/** Vérifie que la scheduled_date d'une séance tombe dans la plage de sa zone. */
function validateSessionPlacement(
  zone: Zone,
  scheduledDate: string,
  bounds: WeekBounds,
  weekNumber: number,
  tag: string,
  errors: string[],
): void {
  const range = zoneRangeForWeek(bounds, zone)
  if (!range) {
    errors.push(`${tag} : zone ${zone} indisponible en semaine ${weekNumber} (plage hors de la semaine partielle)`)
    return
  }
  const ts = dayTs(scheduledDate)
  if (ts < dayTs(range.start) || ts > dayTs(range.end)) {
    const label = zone === "renfo" ? "la semaine" : `la plage zone ${zone}`
    errors.push(`${tag} : scheduled_date ${scheduledDate} (${zoneDow(scheduledDate)}) hors de ${label} [${range.start} → ${range.end}]`)
  }
}

const DOW_LABELS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
const zoneDow = (iso: string) => DOW_LABELS[dayOfWeek(iso) - 1] ?? "?"
