// Mapping PUR des steps de course (schema session_steps aplati) vers le format
// texte de description d'un workout Intervals.icu. Aucune I/O reseau ni base :
// uniquement des fonctions exportees et testables.
//
// Syntaxe (workout builder Intervals.icu, cf. forum "Workout builder syntax
// quick guide") :
//   - Steps hors bloc repete : lignes commencant par "- ".
//   - Bloc repete : une ligne d'en-tete "<libelle> Nx" SANS tiret, precedee ET
//     suivie d'une ligne vide, puis les steps du bloc en lignes "- " NON
//     indentees (les repetitions imbriquees ne sont pas supportees).
//   - "m" = minutes (jamais metres) ; les metres s'ecrivent "Nmtr", les km "Nkm".
//   - Une allure cible DOIT porter le suffixe "Pace", sinon elle n'est pas
//     reconnue et l'intensite est perdue (target retombe sur POWER).
//   - Tout texte place avant la duree devient le libelle du step.

import type { PlanStep } from "./types.ts"

// Libelle des blocs repetes. Le compteur "Nx" dans l'en-tete fait numeroter les
// repetitions par Intervals.icu : "Fractionne 1/5", "Fractionne 2/5"...
const REPEAT_LABEL = "Fractionne"

// Libelle place devant la duree pour les steps identifiables. Les intervalles et
// les steps de course simples restent sans libelle (comme dans la doc de ref).
const STEP_LABEL: Partial<Record<PlanStep["step_type"], string>> = {
  warmup: "Echauffement",
  cooldown: "Retour au calme",
  recovery: "Recuperation",
}

/** Deux chiffres, pour les secondes d'une allure. */
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/**
 * Duree en secondes vers un token Intervals.icu :
 *   multiple de 60 -> "Nm" ; sinon "NmMs" au dela de 60 ; sinon "Ns".
 */
export function formatDurationToken(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s % 60 === 0) return `${s / 60}m`
  if (s > 60) return `${Math.floor(s / 60)}m${s % 60}s`
  return `${s}s`
}

/**
 * Distance en metres vers un token : "Nkm" si multiple de 1000, sinon "Nmtr".
 * Jamais de decimale.
 */
export function formatDistanceToken(m: number): string {
  const meters = Math.max(0, Math.round(m))
  return meters % 1000 === 0 ? `${meters / 1000}km` : `${meters}mtr`
}

/** Allure en secondes par km vers mm:ss. */
export function formatPace(paceSec: number): string {
  const s = Math.max(0, Math.round(paceSec))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}

/**
 * Cible d'allure absolue en /km, suffixee du mot cle "Pace". Avec une tolerance,
 * plage [allure - tolerance, allure + tolerance] du plus rapide (secondes les
 * plus basses) au plus lent. Sans allure cible, retourne null (allure libre).
 */
export function paceTarget(
  paceSec: number | null | undefined,
  tolSec: number | null | undefined,
): string | null {
  if (paceSec == null) return null
  if (tolSec != null && tolSec > 0) {
    return `${formatPace(paceSec - tolSec)}-${formatPace(paceSec + tolSec)}/km Pace`
  }
  return `${formatPace(paceSec)}/km Pace`
}

/** Borne d'un step : distance si renseignee, sinon duree. Null si aucune. */
export function sizeToken(step: PlanStep): string | null {
  if (step.distance_m != null) return formatDistanceToken(step.distance_m)
  if (step.duration_sec != null) return formatDurationToken(step.duration_sec)
  return null
}

/** Ligne de step "- <libelle> <taille> <allure>", chaque part omise si vide. */
function stepLine(step: PlanStep): string {
  const label = STEP_LABEL[step.step_type] ?? ""
  const size = sizeToken(step) ?? ""
  const pace = paceTarget(step.target_pace_sec, step.pace_tolerance_sec)
  return `- ${[label, size, pace].filter(Boolean).join(" ")}`
}

// Element regroupe : un step simple, ou un bloc repete reconstruit.
export type WorkoutItem =
  | { kind: "step"; step: PlanStep }
  | { kind: "repeat"; count: number; interval: PlanStep; recovery: PlanStep | null }

/**
 * Regroupe les steps aplatis par repeat_group (inverse de expand.ts) : un groupe
 * de N repetitions vaut N steps 'interval' + (N-1) steps 'recovery'. Le count est
 * le nombre d'intervalles ; l'allure du bloc est celle du premier intervalle, la
 * recuperation celle du premier step de recuperation du groupe.
 */
export function groupByRepeat(steps: PlanStep[]): WorkoutItem[] {
  const sorted = [...steps].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  const items: WorkoutItem[] = []
  let i = 0
  while (i < sorted.length) {
    const st = sorted[i]
    if (st.repeat_group != null) {
      const g = st.repeat_group
      const group: PlanStep[] = []
      while (i < sorted.length && sorted[i].repeat_group === g) group.push(sorted[i++])
      const intervals = group.filter((s) => s.step_type === "interval")
      const recovery = group.find((s) => s.step_type === "recovery") ?? null
      items.push({
        kind: "repeat",
        count: intervals.length || 1,
        interval: intervals[0] ?? group[0],
        recovery,
      })
    } else {
      items.push({ kind: "step", step: st })
      i++
    }
  }
  return items
}

/**
 * Description texte complete d'un workout, prete pour le champ description.
 * Chaque bloc repete est isole par une ligne vide avant et apres (exige par la
 * syntaxe, sinon le "Nx" se colle a la ligne precedente).
 */
export function buildWorkoutDescription(steps: PlanStep[] | undefined | null): string {
  const items = groupByRepeat(steps ?? [])
  const lines: string[] = []
  for (const it of items) {
    if (it.kind === "repeat") {
      if (lines.length) lines.push("") // ligne vide avant le bloc
      lines.push(`${REPEAT_LABEL} ${it.count}x`)
      lines.push(stepLine(it.interval))
      if (it.recovery) lines.push(stepLine(it.recovery))
      lines.push("") // ligne vide apres le bloc
    } else {
      lines.push(stepLine(it.step))
    }
  }
  // Collapse d'eventuelles lignes vides consecutives, puis retrait aux extremites.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+/, "").replace(/\n+$/, "")
}
