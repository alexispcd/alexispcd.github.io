import { Box, ButtonBase, Typography } from '@mui/material'
import { keyframes } from '@emotion/react'
import { radius, space, textStyles } from '../styles/tokens'
import { DURATION, EASE } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'
import { Coche } from './Icones'

// Intensité (A facile, B qualité, C longue) → couleur pleine et teinte du thème.
const COULEURS = {
  A: { main: 'var(--zone-facile)', tint: 'var(--zone-facile-tint)' },
  B: { main: 'var(--zone-qualite)', tint: 'var(--zone-qualite-tint)' },
  C: { main: 'var(--zone-longue)', tint: 'var(--zone-longue-tint)' },
}

const fondu = keyframes`from { opacity: 0; } to { opacity: 1; }`

/**
 * BlocZone : une séance de course dans son créneau de la GrilleSemaine.
 * - intensite : 'A', 'B' ou 'C' (d'après le type, jamais la lettre de zone).
 * - libelle (« Facile », « Course »), titre court en corps-fort ink, statut en
 *   legende avec la coche si `coche`.
 * - colonne : `grid-column` dans la grille de 7 jours (« 3 / span 3 »).
 * Taper le bloc appelle onClick. Appui : calque ink à 14 %.
 */
const BlocZone = ({ intensite = 'A', libelle, titre, statut, coche = false, colonne, onClick, sx }) => {
  const c = COULEURS[intensite] ?? COULEURS.A
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        gridColumn: colonne, minWidth: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start',
        gap: '2px', p: space[8], textAlign: 'left',
        bgcolor: c.tint, color: c.main, borderRadius: radius.inner,
        '&::after': { backgroundColor: 'var(--ink)' },
        ...focusContour,
        ...sx,
      }}
    >
      <Typography component="span" sx={{ ...textStyles.etiquette, overflowWrap: 'anywhere' }}>{libelle}</Typography>
      <Typography component="span" variant="corps-fort" sx={{ color: 'ink', overflowWrap: 'anywhere' }}>{titre}</Typography>
      <Box
        component="span"
        key={statut}
        sx={{
          ...textStyles.legende, display: 'flex', alignItems: 'center', gap: space[4], overflowWrap: 'anywhere',
          fontVariantNumeric: 'tabular-nums',
          animation: `${fondu} ${DURATION.fade}ms ${EASE}`,
          ...sansMouvement(),
        }}
      >
        {coche && <Coche taille={12} strokeWidth="3" style={{ flexShrink: 0 }} />}
        <span>{statut}</span>
      </Box>
    </ButtonBase>
  )
}

export default BlocZone
