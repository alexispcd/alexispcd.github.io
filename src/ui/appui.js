// Styles d'appui et de focus partagés par les composants de src/ui.
// Le calque d'un objet touchable en entier (14 % de la couleur du texte) est déjà posé
// par le thème sur toute ButtonBase (src/styles/theme.js, MuiButtonBase).
import { border, opacity } from '../styles/tokens'

/**
 * Appui d'une ligne (liste, LigneSaisie, LigneModule, lignes d'une feuille) : calque
 * ink à 6 % sur toute la largeur, sans changement de taille, même avec le réglage
 * « Agrandit ». Remplace le calque de la ButtonBase ; les durées (100 ms, 200 ms) et
 * la réduction des animations restent celles du thème.
 */
export const appuiLigne = {
  '&::after': { backgroundColor: 'var(--ink)' },
  '&:active::after': { opacity: opacity.ligne },
  'html[data-pression="agrandit"] &:active': { transform: 'none' },
}

/** Focus clavier visible : contour 2 px ink, décalé de 2 px. */
export const focusContour = {
  '&:focus-visible, &.Mui-focusVisible': {
    outline: `${border.contour} solid var(--ink)`,
    outlineOffset: '2px',
  },
}

/** Focus clavier d'une ligne pleine largeur : contour à l'intérieur, la carte coupe le reste. */
export const focusContourInterieur = {
  '&:focus-visible, &.Mui-focusVisible': {
    outline: `${border.contour} solid var(--ink)`,
    outlineOffset: `-${border.contour}`,
  },
}

/** Aucune transition quand l'iPhone demande de réduire les animations. */
export const sansMouvement = (selecteurs = '&') => ({
  '@media (prefers-reduced-motion: reduce)': {
    [selecteurs]: { transition: 'none', animation: 'none' },
  },
})
