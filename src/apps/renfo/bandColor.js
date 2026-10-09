// Couleurs des élastiques : palette proposée à l'ajout et couleur lisible du
// texte (le kg) posé sur une pastille.

export const BAND_PALETTE = [
  { hex: '#9FDCA9', name: 'Vert menthe' },
  { hex: '#B3BDCC', name: 'Gris-bleu' },
  { hex: '#F2D16B', name: 'Jaune' },
  { hex: '#EFA24F', name: 'Orange' },
  { hex: '#7A2F42', name: 'Bordeaux' },
  { hex: '#D64545', name: 'Rouge' },
  { hex: '#2F68CC', name: 'Bleu' },
  { hex: '#2B9A64', name: 'Vert' },
  { hex: '#7348B8', name: 'Violet' },
  { hex: '#E57FB0', name: 'Rose' },
  { hex: '#222222', name: 'Noir' },
  { hex: '#8A8F98', name: 'Gris' },
]

/** Pastille d'un kg absent de l'inventaire (bande supprimée depuis). */
export const NEUTRAL_BAND = '#8A8F98'

export const isHexColor = (value) => /^#[0-9A-Fa-f]{6}$/.test(value ?? '')

// Luminance relative WCAG d'une couleur #rrggbb.
const luminance = (hex) => {
  const channel = (i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Texte lisible sur une pastille : sombre sur une couleur claire, blanc sur une foncée. */
export const textOnColor = (hex) => {
  if (!isHexColor(hex)) return '#ffffff'
  // Seuil où le contraste avec le blanc égale celui avec #111111.
  return luminance(hex) > 0.18 ? '#111111' : '#ffffff'
}

/** Couleur d'une bande d'après son kg dans l'inventaire, ou la couleur neutre. */
export const bandColorFor = (bands, kg) =>
  bands.find((b) => Number(b.kg) === Number(kg))?.color ?? NEUTRAL_BAND

/** Affichage d'un poids : 12.5 → "12,5". */
export const formatKg = (kg) => String(kg).replace('.', ',')
