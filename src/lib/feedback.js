// Helpers du ressenti post-séance (RPE), partagés entre RpeForm (src/components) et les flux de
// complétion. Séparés du composant pour ne pas casser le fast refresh.

/** État initial d'un ressenti vierge. */
export const emptyFeedback = () => ({ rpe: null, painAreas: [], note: '' })

/**
 * Convertit la valeur du formulaire en payload BDD, ou null si totalement vierge.
 * Chaque champ est indépendant (RPE seul, douleurs seules, etc.).
 */
export const toFeedbackPayload = (value) => {
  const rpe = value.rpe ?? null
  const pain_areas = value.painAreas.length ? value.painAreas : null
  const feedback_note = value.note.trim() ? value.note.trim() : null
  if (rpe == null && pain_areas == null && feedback_note == null) return null
  return { rpe, pain_areas, feedback_note }
}

// Zones de douleur avec latéralité. Les codes sont figés (persistés en BDD et
// relus par les Edge Functions), les libellés servent uniquement à l'UI.
const PAIN_AREAS = [
  { base: 'mollet', label: 'Mollet', sided: true },
  { base: 'genou', label: 'Genou', sided: true },
  { base: 'achille', label: 'Achille', sided: true },
  { base: 'quadri', label: 'Cuisse', sided: true },
  { base: 'tfl', label: 'Hanche / TFL', sided: true },
  { base: 'epaule', label: 'Épaule', sided: true },
  { base: 'coude', label: 'Coude', sided: true },
  { base: 'dos', label: 'Dos', sided: false },
  { base: 'autre', label: 'Autre', sided: false },
]

// Développe la config en liste plate de chips { code, label }.
export const PAIN_CHIPS = PAIN_AREAS.flatMap((a) =>
  a.sided
    ? [
        { code: `${a.base}_g`, label: `${a.label} G` },
        { code: `${a.base}_d`, label: `${a.label} D` },
      ]
    : [{ code: a.base, label: a.label }]
)

/** Libellé court d'une zone de douleur (« Genou G »), ou le code s'il est inconnu. */
export const painAreaLabel = (code) => PAIN_CHIPS.find((c) => c.code === code)?.label ?? code
