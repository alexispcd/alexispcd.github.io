import { useId } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, avecRetour, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'

const COULEURS = {
  ink: { bgcolor: 'ink', color: 'on-ink' },
  chip: { bgcolor: 'chip', color: 'ink' },
  texte: { bgcolor: 'transparent', color: 'muted' },
}

/**
 * Bouton plein du Design System.
 * - variante : 'ink' (action principale), 'chip' (secondaire), 'texte' (muted, sans fond).
 * - niveau : 'dedans' (posé dans une carte ou une barre, radius-inner) ou 'page'
 *   (au niveau des cartes, directement sur bg, radius-card).
 * - petit : 44 px au lieu de 52.
 * - disabled exige `raison`, affichée en `secondaire` juste au-dessus (centrée si
 *   le bouton est pleine largeur) : jamais de bouton désactivé sans explication.
 * - raisonDansBarre : la raison est portée par la BarreBas (sa prop `phrase`), le
 *   bouton ne l'affiche pas ; un aria-describedby passé en prop est transmis.
 */
const Bouton = ({
  variante = 'ink',
  niveau = 'dedans',
  petit = false,
  pleineLargeur = false,
  disabled = false,
  raison,
  raisonDansBarre = false,
  children,
  sx,
  ...rest
}) => {
  const raisonId = useId()
  if (disabled && !raison && !raisonDansBarre && import.meta.env.DEV) {
    console.error('[Bouton] bouton désactivé sans `raison`')
  }
  const raisonAffichee = disabled && Boolean(raison) && !raisonDansBarre

  const couleurs = disabled
    ? { bgcolor: variante === 'texte' ? 'transparent' : 'track', color: 'muted' }
    : COULEURS[variante] ?? COULEURS.ink

  const bouton = (
    <ButtonBase
      disabled={disabled}
      aria-describedby={raisonAffichee ? raisonId : undefined}
      sx={{
        ...textStyles.bouton,
        height: petit ? size.cible : size.ligne,
        px: space[16],
        width: pleineLargeur ? '100%' : 'auto',
        borderRadius: niveau === 'page' ? radius.card : radius.inner,
        ...couleurs,
        transition: avecRetour(transition(['background-color', 'color'], DURATION.fade)),
        ...sansMouvement(),
        ...focusContour,
        ...sx,
      }}
      {...rest}
    >
      {children}
    </ButtonBase>
  )

  if (!raisonAffichee) return bouton
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], width: pleineLargeur ? '100%' : 'auto' }}>
      <Typography id={raisonId} variant="secondaire" sx={{ color: 'muted', textAlign: pleineLargeur ? 'center' : undefined }}>{raison}</Typography>
      {bouton}
    </Box>
  )
}

export default Bouton
