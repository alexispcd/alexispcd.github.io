// Lecture du contenu d'une séance Renfo (strength_sessions.content), sans React.
// Partagé par l'accueil, la page séance et le player.

import { EXERCISE_INDEX } from '../../../supabase/functions/_shared/strength/catalog.ts'

/** Libellés des blocs, dans l'ordre du schéma. */
export const blockLabel = (block, index, blocks) => {
  if (block.type === 'warmup') return 'Échauffement'
  if (block.type === 'main') return 'Bloc principal'
  if (block.type === 'cooldown') return 'Retour au calme'
  const n = blocks.slice(0, index + 1).filter((b) => b.type === 'superset').length
  return `Superset ${n}`
}

export const ANCHOR_LABELS = {
  high: 'Barre en haut',
  mid: 'Barre à mi-hauteur',
  low: 'Barre en bas',
}

/** Consigne de déplacement de la barre vers une hauteur. */
export const MOVE_BAR_LABELS = {
  high: 'Déplace la barre en haut',
  mid: 'Déplace la barre à mi-hauteur',
  low: 'Déplace la barre en bas',
}

/** Tous les dosages d'une séance dans l'ordre de jeu : { dose, block, blockIndex, role }. */
export const listDoses = (content) => {
  const out = []
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  blocks.forEach((block, blockIndex) => {
    if (block.type === 'superset') {
      if (block.a) out.push({ dose: block.a, block, blockIndex, role: 'A' })
      if (block.b) out.push({ dose: block.b, block, blockIndex, role: 'B' })
    } else {
      for (const dose of block.items ?? []) out.push({ dose, block, blockIndex, role: null })
    }
  })
  return out
}

/** Bande d'un exercice : celle réellement jouée si elle existe, sinon celle prévue. */
export const bandOf = (dose, bandsUsed) => bandsUsed?.[dose.slug] ?? dose.band_kg ?? null

/** Poids des bandes utilisées dans la séance, distincts et triés. */
export const usedBands = (content, bandsUsed) => {
  const kgs = listDoses(content).map(({ dose }) => bandOf(dose, bandsUsed)).filter((kg) => kg != null)
  return [...new Set(kgs.map(Number))].sort((a, b) => a - b)
}

/** Matériel de la séance : hauteurs de barre dans l'ordre d'usage, chaise, bandes. */
export const equipmentSummary = (content, bandsUsed) => {
  const anchors = []
  let chair = false
  for (const { dose } of listDoses(content)) {
    const ex = EXERCISE_INDEX[dose.slug]
    if (!ex) continue
    if (ex.equipment.includes('bar') && ex.anchor && !anchors.includes(ex.anchor)) anchors.push(ex.anchor)
    if (ex.equipment.includes('chair')) chair = true
  }
  return { anchors, chair, bands: usedBands(content, bandsUsed) }
}

/** Dosage lisible d'un exercice : "8 rép.", "30 s", avec "par côté" si unilatéral. */
export const doseLabel = (dose) => {
  const ex = EXERCISE_INDEX[dose.slug]
  const value = dose.duration_sec != null ? `${dose.duration_sec} s` : `${dose.reps} rép.`
  return ex?.unilateral ? `${value} par côté` : value
}

/** Ligne de dosage d'un exercice du bloc principal : "4 × 8 · repos 90 s". */
export const mainDoseLabel = (item) => {
  const ex = EXERCISE_INDEX[item.slug]
  const value = item.duration_sec != null ? `${item.duration_sec} s` : `${item.reps}`
  const side = ex?.unilateral ? ' par côté' : ''
  return `${item.sets} × ${value}${side} · repos ${item.rest_sec} s`
}

/** En-tête d'un superset : "3 tours · repos 75 s après B". */
export const supersetLabel = (block) => `${block.rounds} tours · repos ${block.rest_sec} s après B`

/** Chemin d'une photo d'exercice (frame 0 = départ, 1 = arrivée), ou null sans photo. */
export const photoUrl = (slug, frame) =>
  EXERCISE_INDEX[slug]?.image ? `${import.meta.env?.BASE_URL ?? '/'}renfo/${slug}-${frame}.webp` : null
