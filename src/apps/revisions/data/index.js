// Decouverte automatique des themes de revision.
// Chaque fichier JSON depose dans ce dossier est charge au build : deposer un
// nouveau theme suffit, aucun code a toucher. Un dossier vide est un cas normal.
const modules = import.meta.glob('./*.json', { eager: true })

const files = Object.values(modules)
  .map((mod) => mod?.default ?? mod)
  .filter((file) => file && typeof file.themeId === 'string' && Array.isArray(file.cards))
  .sort((a, b) => String(a.theme).localeCompare(String(b.theme), 'fr'))

// Liste des themes disponibles, sans les cartes.
export const themes = files.map((file) => ({
  themeId: file.themeId,
  theme: file.theme,
  version: file.version ?? null,
  cardCount: file.cards.length,
}))

// Index plat de toutes les cartes, chacune enrichie de son theme.
// L'id vient du fichier et n'est jamais recalcule : c'est la cle de persistance.
export const cards = files.flatMap((file) =>
  file.cards.map((card) => ({ ...card, themeId: file.themeId, theme: file.theme })),
)

export const themeLabels = Object.fromEntries(themes.map((t) => [t.themeId, t.theme]))

// Valeurs de filtre deduites des donnees chargees, jamais codees en dur.
const distinct = (key) => [...new Set(cards.map((card) => card[key]).filter(Boolean))].sort()

export const cardTypes = distinct('type')
export const cardAngles = distinct('angle')
