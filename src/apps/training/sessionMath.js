// Helpers partagés de Training : durées, distances, allure clé et groupes d'étapes.
// Toute l'estimation est faite en code, sans dépendance.
import { formatDistance, formatDuration } from './constants.js'

// Allure souple par défaut quand un step n'a pas de cible (récup libre) mais
// qu'on doit tout de même estimer sa durée / distance.
const FALLBACK_PACE_SEC = 360

const stepPace = (step) => step.target_pace_sec ?? FALLBACK_PACE_SEC

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

/**
 * Km prévus d'une séance, en mètres : une étape en distance compte sa distance, une
 * étape en durée avec allure cible compte durée / allure ; une étape sans distance ni
 * allure cible (récupération) compte 0. Pas d'allure de repli, contrairement aux durées.
 */
export const plannedMeters = (steps) =>
  (steps ?? []).reduce((a, s) => {
    if (s.distance_m != null) return a + s.distance_m
    if (s.duration_sec != null && s.target_pace_sec) return a + (s.duration_sec / s.target_pace_sec) * 1000
    return a
  }, 0)

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

/** "400 m" / "3 min" : dimension primaire d'un step. */
export const stepSizeLabel = (step) =>
  formatDistance(step.distance_m) ?? formatDuration(step.duration_sec) ?? ''
