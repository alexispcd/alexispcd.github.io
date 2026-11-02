import { Box } from '@mui/material'
import { keyframes } from '@emotion/react'
import { border, radius, space, textStyles } from '../styles/tokens'
import { DURATION, EASE } from '../styles/motion'
import { sansMouvement } from './appui'
import { textOnColor } from '../apps/renfo/bandColor'

// Fondu du texte quand le statut change : le nouveau texte arrive en 150 ms.
const fondu = keyframes`from { opacity: 0; } to { opacity: 1; }`

const statut = { ...textStyles.secondaire, fontWeight: 600 }
const moins = (marge, trait) => `calc(${marge} - ${trait})`
const petite = { ...textStyles.legende, fontWeight: 600, height: '22px', px: space[8] }

// Une pastille à contour retire son trait de sa marge pour garder la même taille
// (README, Espacements : 4 × 12, et 3 × 11 avec un trait de 1 px).
const VARIANTES = {
  pleine: { ...statut, py: space[4], px: space[12], bgcolor: 'chip', color: 'ink' },
  contour: { ...statut, py: moins(space[4], border.filet), px: moins(space[12], border.filet), border: `${border.filet} solid`, borderColor: 'line', color: 'ink' },
  aujourdhui: { ...statut, py: moins(space[4], border.contour), px: moins(space[12], border.contour), border: `${border.contour} solid`, borderColor: 'ink', color: 'ink' },
  adaptee: { ...statut, py: moins(space[4], border.filet), px: moins(space[12], border.filet), border: `${border.filet} dashed`, borderColor: 'muted', color: 'muted' },
  materiel: { ...petite, bgcolor: 'chip', color: 'ink', border: `${border.filet} solid`, borderColor: 'line' },
  enCours: { ...petite, fontWeight: 700, bgcolor: 'ink', color: 'on-ink', border: `${border.filet} solid`, borderColor: 'ink' },
}

/**
 * Pastille : statut ou repère court, jamais un bouton (voir PastilleACocher).
 * - variante : 'pleine' (état attendu), 'contour' (repère ou autre état),
 *   'aujourdhui' (contour ink 2 px), 'adaptee' (pointillés muted),
 *   'materiel' (Renfo, 22 px), 'bande' (vraie couleur en `couleur`), 'enCours'.
 * - grande : pastille de bande en taille normale (26 px, 13 px gras), Réglages Renfo.
 * Ne passe jamais à la ligne : c'est le texte à côté qui se replie.
 */
const Pastille = ({ variante = 'pleine', couleur, grande = false, children, sx, ...rest }) => {
  const style = variante === 'bande'
    ? {
        ...(grande ? { ...statut, height: '26px', px: moins(space[12], border.filet) } : petite),
        fontWeight: 700,
        bgcolor: couleur,
        color: textOnColor(couleur),
        border: `${border.filet} solid`,
        borderColor: 'line',
      }
    : VARIANTES[variante] ?? VARIANTES.pleine

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        borderRadius: radius.pill,
        fontVariantNumeric: 'tabular-nums',
        ...style,
        ...sx,
      }}
      {...rest}
    >
      <Box
        component="span"
        key={typeof children === 'string' || typeof children === 'number' ? children : undefined}
        sx={{ animation: `${fondu} ${DURATION.fade}ms ${EASE}`, ...sansMouvement() }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Pastille
