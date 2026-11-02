// Jetons du Design System, dérivés de tokens.json (copie exacte, source de vérité).
// Les rayons, espacements, hauteurs et traits sont exportés en chaînes « px » : un
// nombre passé à `sx` serait multiplié par `shape.borderRadius` ou `spacing`.
// Attribut d'import : rend ce module lisible par les tests Node (node --test).
import tokens from './tokens.json' with { type: 'json' }

const THEMES = tokens.color.themes.map((t) => t.id)

/** Couleurs par thème : { light: { bg, surface, ink, ... }, dark: { ... } }. */
export const colors = Object.fromEntries(THEMES.map((id) => [
  id,
  Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value[id]])),
]))

/** Variables CSS d'un thème : { '--ink': '#15171A', '--zone-facile': ..., ... }. */
export const cssVars = (mode) => Object.fromEntries(
  Object.entries(colors[mode]).map(([name, value]) => [`--${name}`, value]),
)

// « space-14 » -> 14, « hauteur-ligne-double » -> ligneDouble.
const shortKey = (name, prefix) => name
  .slice(prefix.length)
  .replace(/-([a-z])/g, (_m, c) => c.toUpperCase())

const scale = (family, prefix) => Object.fromEntries(
  tokens[family].tokens.map((t) => [shortKey(t.name, prefix), t.value]),
)

/** Espacements : space[14] === '14px', space.bas === '34px'. */
export const space = scale('spacing', 'space-')
/** Rayons : radius.card === '24px', radius.inner, radius.pill... */
export const radius = scale('radius', 'radius-')
/** Hauteurs : size.cible === '44px', size.ligne, size.ligneDouble, size.player. */
export const size = scale('size', 'hauteur-')
/** Traits : border.filet === '1px', border.contour, border.selection. */
export const border = scale('border', 'trait-')
/** Calques, en fraction : opacity.appui === 0.14, opacity.ligne === 0.06. */
export const opacity = Object.fromEntries(
  tokens.opacity.tokens.map((t) => [shortKey(t.name, 'calque-'), parseFloat(t.value) / 100]),
)

/** Famille de texte du Design System. */
export const fontFamily = tokens.type.families.sans

/** Styles de texte nommés comme dans le Design System : textStyles['corps-fort']. */
export const textStyles = Object.fromEntries(
  tokens.type.groups.flatMap((g) => g.styles).map((s) => [
    s.name,
    {
      fontFamily,
      fontSize: s.fontSize,
      lineHeight: s.lineHeight,
      fontWeight: s.fontWeight,
      ...(s.letterSpacing ? { letterSpacing: s.letterSpacing } : {}),
    },
  ]),
)

const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}

/**
 * Composantes du voile par thème : jeton de couleur et opacité. Lues aussi par le
 * mélange du voile sur bg (src/lib/barreEtat.js).
 */
export const VEIL = {
  light: { token: 'ink', alpha: 0.35 },
  dark: { token: 'on-ink', alpha: 0.7 },
}

/** Voile derrière une feuille ou un dialogue : ink à 35 % en clair, on-ink à 70 % en sombre. */
export const veil = (mode) => rgba(colors[mode][VEIL[mode].token], VEIL[mode].alpha)

/**
 * Marge basse d'une barre du bas : zone basse de l'iPhone (34 px en config B), 16 px
 * au moins ailleurs. Pour les lots suivants ; les écrans actuels gardent leurs marges.
 */
export const SPACE_BAS = 'max(env(safe-area-inset-bottom, 0px), 16px)'
