// Calculs purs des Réglages Renfo : brouillon des élastiques, report des bases
// d'exercices vers les nouveaux poids et phrases de confirmation.
// Un élastique du brouillon : { kg, color, origine }, `origine` valant le poids
// enregistré dont il vient, ou null s'il est nouveau.

import { bandeLaPlusProche } from '../../../supabase/functions/_shared/strength/compose.ts'
import { formatKg } from './bandColor.js'

/** Poids tapé (virgule acceptée) : un nombre, ou NaN. */
export const lirePoids = (texte) => {
  const brut = String(texte ?? '').trim().replace(',', '.')
  if (brut === '') return NaN
  const n = Number(brut)
  return Number.isFinite(n) ? n : NaN
}

/**
 * Report des bases : pour chaque poids enregistré, le poids qui le remplace dans le
 * brouillon (l'élastique qui en vient, sinon le même poids, sinon le plus proche ;
 * rien si le brouillon est vide). Renvoie [{ de, vers }] sans les entrées inchangées.
 */
export const planDeReport = (enregistres, brouillon) => {
  const poids = brouillon.map((b) => Number(b.kg))
  const report = []
  for (const { kg } of enregistres) {
    const s = Number(kg)
    const venu = brouillon.find((b) => b.origine != null && Number(b.origine) === s)
    const vers = venu
      ? Number(venu.kg)
      : poids.includes(s) ? s : bandeLaPlusProche(s, poids)
    if (vers != null && vers !== s) report.push({ de: s, vers })
  }
  return report
}

/** Élastique d'une base après le report. */
const reporte = (kg, report) => {
  if (kg == null) return kg
  const entree = report.find((r) => r.de === Number(kg))
  return entree ? entree.vers : Number(kg)
}

/** Bases ({ [slug]: { band_kg, ... } }) avec leurs élastiques reportés. */
export const appliquerReport = (bases, report) =>
  Object.fromEntries(Object.entries(bases ?? {}).map(([slug, base]) =>
    [slug, base?.band_kg == null ? base : { ...base, band_kg: reporte(base.band_kg, report) }]))

/** Nombre de bases dont l'élastique, après le report, vaut kg. */
export const nombreExercices = (bases, report, kg) =>
  Object.values(bases ?? {}).filter((b) => b?.band_kg != null && reporte(b.band_kg, report) === Number(kg)).length

/** Titre de la confirmation de suppression d'un élastique. */
export const phraseSuppression = (kg, n, cible) => {
  if (cible == null) return "C'était ton dernier élastique : les exercices qui en demandent ne seront plus proposés."
  const debut = `L'élastique de ${formatKg(kg)} kg ne sera plus proposé.`
  if (n === 0) return debut
  const proche = `l'élastique le plus proche, ${formatKg(cible)} kg.`
  return n === 1
    ? `${debut} 1 exercice l'utilise : il passera à ${proche}`
    : `${debut} ${n} exercices l'utilisent : ils passeront à ${proche}`
}

const normaliser = ({ frequency, equipment, bands }) => JSON.stringify([
  Number(frequency),
  [...(equipment ?? [])].sort(),
  [...(bands ?? [])].map((b) => [Number(b.kg), b.color]).sort((x, y) => x[0] - y[0]),
])

/** Mêmes réglages : objectif, matériel (sans ordre), élastiques (kg, couleur) sans origine. */
export const memesReglages = (a, b) => normaliser(a) === normaliser(b)
