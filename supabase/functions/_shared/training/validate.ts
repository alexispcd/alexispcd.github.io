import type { CompactStep, GeneratedPlan, PlanSession } from "./types.ts"
import { isRepeatBlock } from "./expand.ts"
import { dayOfWeek, dayTs, type WeekBounds, type Zone, zoneRangeForWeek } from "./weeks.ts"
import {
  BLOCK_CATEGORIES, detectBonusKind, EXERCISE_INDEX, type ExerciseCategory, isExerciseSlug,
} from "./exercises.ts"
import { estimateStrengthDuration } from "./strength.ts"

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

// ── Renfo (catalogue + structure 4 blocs) ─────────────────────────────────────
const RENFO_MIN_EXERCISES = 10
const RENFO_MAX_EXERCISES = 13
const RENFO_BASE_MIN_MIN = 40
const RENFO_BASE_MAX_MIN = 50

/**
 * Valide le strength_content d'une séance renfo (sortie modèle, base ~45 min) :
 * exactement 4 blocs dans l'ordre, slugs du catalogue, catégories cohérentes par
 * bloc, bornes (sets 1-5, rest 0-120), 10 à 13 exercices, durée estimée 40-50 min.
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

  let totalExos = 0
  blocks.forEach((bU, bi) => {
    const btag = `${tag} bloc ${bi + 1}`
    const exos = (bU as { exercises?: unknown }).exercises
    if (!Array.isArray(exos) || exos.length === 0) {
      errors.push(`${btag} : aucun exercice`)
      return
    }
    totalExos += exos.length

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
      const sets = ex.sets
      if (typeof sets !== "number" || !Number.isInteger(sets) || sets < 1 || sets > 5) {
        errors.push(`${etag} (${ex.slug}) : sets doit être un entier entre 1 et 5`)
      }
      const rest = ex.rest_sec
      if (typeof rest !== "number" || rest < 0 || rest > 120) {
        errors.push(`${etag} (${ex.slug}) : rest_sec doit être entre 0 et 120`)
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

  if (totalExos < RENFO_MIN_EXERCISES || totalExos > RENFO_MAX_EXERCISES) {
    errors.push(`${tag} : ${totalExos} exercices au total (attendu ${RENFO_MIN_EXERCISES} à ${RENFO_MAX_EXERCISES})`)
  }

  const est = estimateStrengthDuration(blocks as never)
  if (est < RENFO_BASE_MIN_MIN || est > RENFO_BASE_MAX_MIN) {
    errors.push(`${tag} : durée estimée de la base ${est} min hors bornes (${RENFO_BASE_MIN_MIN} à ${RENFO_BASE_MAX_MIN} min)`)
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
