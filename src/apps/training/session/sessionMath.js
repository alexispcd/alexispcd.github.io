// Helpers partagés entre SessionPage (totaux, structure) et PaceChart (échelles).
// Toute l'estimation est faite en code, sans dépendance.
import { formatDistance, formatDuration } from '../constants'

// Allure souple par défaut quand un step n'a pas de cible (récup libre) mais
// qu'on doit tout de même estimer sa durée / distance.
export const FALLBACK_PACE_SEC = 360

export const stepPace = (step) => step.target_pace_sec ?? FALLBACK_PACE_SEC

/** Durée estimée d'un step en secondes (largeur graphe + durée totale). */
export const estimateStepSeconds = (step) => {
  if (step.duration_sec != null) return step.duration_sec
  if (step.distance_m != null) return Math.round((step.distance_m / 1000) * stepPace(step))
  return null
}

/** Distance estimée d'un step en mètres (distance totale). */
export const estimateStepMeters = (step) => {
  if (step.distance_m != null) return step.distance_m
  if (step.duration_sec != null) return Math.round((step.duration_sec / stepPace(step)) * 1000)
  return null
}

/** Somme des distances estimées de tous les steps (mètres). */
export const totalMeters = (steps) =>
  steps.reduce((a, s) => a + (estimateStepMeters(s) ?? 0), 0)

/** Somme des durées estimées de tous les steps (secondes). */
export const totalSeconds = (steps) =>
  steps.reduce((a, s) => a + (estimateStepSeconds(s) ?? 0), 0)

/** Allure clé = allure du step interval/run le plus rapide (secondes/km). */
export const keyPaceSec = (steps) => {
  const paces = steps
    .filter((s) => (s.step_type === 'interval' || s.step_type === 'run') && s.target_pace_sec != null)
    .map((s) => s.target_pace_sec)
  return paces.length ? Math.min(...paces) : null
}

/**
 * Regroupe les steps consécutifs de même repeat_group.
 * → [{ kind: 'repeat'|'single', steps, start, end }] (start/end = index dans steps).
 */
export const groupSteps = (steps) => {
  const groups = []
  let i = 0
  while (i < steps.length) {
    const g = steps[i].repeat_group
    if (g != null) {
      let j = i
      while (j < steps.length && steps[j].repeat_group === g) j++
      groups.push({ kind: 'repeat', steps: steps.slice(i, j), start: i, end: j - 1 })
      i = j
    } else {
      groups.push({ kind: 'single', steps: [steps[i]], start: i, end: i })
      i++
    }
  }
  return groups
}

/** "400 m" / "3 min" — dimension primaire d'un step. */
export const stepSizeLabel = (step) =>
  formatDistance(step.distance_m) ?? formatDuration(step.duration_sec) ?? ''

/** Label court pour un step isolé (tip du graphe, axe X). */
export const stepShortLabel = (step) => {
  switch (step.step_type) {
    case 'warmup': return 'Éch.'
    case 'cooldown': return 'RAC'
    case 'recovery': return 'Récup'
    case 'interval': return step.repeat_index != null ? `Rép ${step.repeat_index}` : 'Répétition'
    default: return 'Course'
  }
}
