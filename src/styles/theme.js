import { createTheme } from '@mui/material/styles'
import { colors, cssVars, radius, opacity, fontFamily, textStyles, veil } from './tokens'
import { EASE, DURATION, RESSORT, AGRANDISSEMENT, transition, avecRetour } from './motion'

// Thème MUI du Design System (src/styles/tokens.json). `shape` et `spacing` restent
// ceux d'avant : les anciens écrans en dépendent (borderRadius et marges numériques).
// Réglage Animations (page Compte) : agrandissement à l'appui, seulement si
// l'iPhone ne demande pas de réduire les animations. Jamais sur une ligne (appuiLigne,
// MuiListItemButton, MuiMenuItem), ni sur le curseur d'un Switch, déjà placé par un
// translateX.
// :where garde la spécificité de la règle des lignes : sans lui, :not(.classe) la battrait.
const AGRANDIT_ACTIF = 'html[data-pression="agrandit"] &:active:where(:not(.MuiSwitch-switchBase))'
const LIGNE_SANS_AGRANDIR = { 'html[data-pression="agrandit"] &:active': { transform: 'none' } }

const theme = (dark) => {
  const mode = dark ? 'dark' : 'light'
  const c = colors[mode]
  // La couleur ne dit que l'intensité : les couleurs de statut MUI sont neutres.
  const neutral = { main: c.ink, light: c.chip, dark: c.ink, contrastText: c['on-ink'] }

  return createTheme({
    palette: {
      mode,
      // Tous les jetons à la racine : `bgcolor: 'chip'`, `color: 'zone-facile'` dans sx.
      ...c,
      primary: { main: c.ink, light: c.chip, dark: c.ink, contrastText: c['on-ink'] },
      secondary: neutral,
      error: neutral,
      warning: neutral,
      success: neutral,
      info: neutral,
      background: { default: c.bg, paper: c.surface },
      text: { primary: c.ink, secondary: c.muted },
      divider: c.line,
    },
    shadows: Array(25).fill('none'),
    typography: {
      fontFamily,
      fontWeightLight: 400,
      fontWeightRegular: 400,
      fontWeightMedium: 600,
      fontWeightBold: 700,
      // Variantes du Design System, utilisables telles quelles : variant="corps-fort".
      ...textStyles,
      etiquette: { ...textStyles.etiquette, textTransform: 'uppercase' },
      // Anciennes variantes rabattues sur les plus proches.
      h1: textStyles['titre-app'],
      h2: textStyles['titre-section'],
      h3: textStyles['titre-section'],
      h4: textStyles['titre-section'],
      h5: textStyles['titre-section'],
      h6: textStyles['titre-barre'],
      subtitle1: textStyles['corps-fort'],
      subtitle2: textStyles['corps-fort'],
      body1: textStyles.corps,
      body2: textStyles.corps,
      caption: textStyles.legende,
      overline: { ...textStyles.etiquette, textTransform: 'uppercase' },
      button: { ...textStyles.bouton, textTransform: 'none' },
    },
    shape: {
      borderRadius: 12,
    },
    transitions: {
      easing: { easeInOut: EASE, easeOut: EASE, easeIn: EASE, sharp: EASE },
      duration: {
        shortest: DURATION.fade,
        shorter: DURATION.close,
        short: DURATION.open,
        standard: DURATION.page,
        complex: DURATION.fill,
        enteringScreen: DURATION.open,
        leavingScreen: DURATION.close,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            ...cssVars(mode),
            // Retour en place après l'agrandissement, ajouté à chaque transition d'un
            // objet touchable (avecRetour de motion.js). Sobre par défaut.
            '--retour-transition': transition('transform', DURATION.release),
          },
          // Ressort : courbe linear(), seulement là où elle est prise en charge.
          '@supports (transition-timing-function: linear(0, 1))': {
            'html[data-retour="ressort"]': {
              '--retour-transition': `transform ${DURATION.ressort}ms ${RESSORT}`,
            },
          },
          'html, body': {
            overscrollBehavior: 'none',
            WebkitTapHighlightColor: 'transparent',
          },
          body: {
            backgroundColor: c.bg,
            color: c.ink,
            fontVariantNumeric: 'tabular-nums',
          },
        },
      },
      MuiTypography: {
        defaultProps: {
          variantMapping: {
            'titre-app': 'h1',
            'titre-section': 'h2',
            'titre-barre': 'h2',
            'chiffre-widget': 'p',
            chiffre: 'p',
            'corps-fort': 'p',
            corps: 'p',
            secondaire: 'p',
            legende: 'p',
            etiquette: 'span',
            bouton: 'span',
            'titre-player': 'h2',
            'chiffre-player': 'p',
            'chiffre-player-moyen': 'p',
          },
        },
      },
      // Appui : calque de la couleur du texte à 14 % pendant le toucher, sans ondulation.
      // :active ne réagit sur iPhone qu'avec l'écouteur touchstart de src/main.jsx.
      MuiButtonBase: {
        defaultProps: { disableRipple: true },
        styleOverrides: {
          root: {
            transition: 'var(--retour-transition)',
            '@media (prefers-reduced-motion: no-preference)': {
              [AGRANDIT_ACTIF]: {
                transform: `scale(${AGRANDISSEMENT})`,
                transition: transition('transform', DURATION.press),
              },
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
              backgroundColor: 'currentColor',
              opacity: 0,
              pointerEvents: 'none',
              transition: transition('opacity', DURATION.release),
            },
            '&:active::after': {
              opacity: opacity.appui,
              transition: transition('opacity', DURATION.press),
            },
            '@media (prefers-reduced-motion: reduce)': {
              '&, &::after, &:active::after': { transition: 'none' },
            },
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: radius.inner,
            textTransform: 'none',
            boxShadow: 'none',
            // Transition de MUI, complétée du retour en place (elle écrase celle de ButtonBase).
            transition: avecRetour(transition(['background-color', 'box-shadow', 'border-color', 'color'], DURATION.open)),
          },
          contained: {
            '&.Mui-disabled': { backgroundColor: c.track, color: c.muted },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { transition: avecRetour(transition('background-color', DURATION.fade)) },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            transition: avecRetour(transition(['background-color', 'box-shadow'], DURATION.page)),
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: LIGNE_SANS_AGRANDIR },
      },
      MuiMenuItem: {
        styleOverrides: { root: LIGNE_SANS_AGRANDIR },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', boxShadow: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            border: 'none',
            boxShadow: 'none',
            borderRadius: radius.card,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { backgroundColor: c.surface, boxShadow: 'none', borderRadius: radius.card },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { backgroundColor: c.surface, boxShadow: 'none', borderRadius: radius.card },
        },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: { backgroundColor: veil(mode) },
          invisible: { backgroundColor: 'transparent' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            backgroundColor: c.chip,
            color: c.ink,
            border: 'none',
            borderRadius: radius.inner,
            '& .MuiAlert-icon': { color: c.muted },
          },
        },
      },
      MuiSwitch: {
        defaultProps: { color: 'primary' },
      },
      MuiSlider: {
        defaultProps: { color: 'primary' },
      },
      MuiCheckbox: {
        defaultProps: { color: 'primary' },
      },
      // 16 px dans les champs : en dessous, Safari zoome au focus.
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: '16px' },
        },
      },
    },
  })
}

export default theme
