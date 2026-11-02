import { Box, ButtonBase } from '@mui/material'
import { keyframes } from '@emotion/react'
import { border, radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, EASE, transition } from '../styles/motion'
import { sansMouvement } from './appui'

// Arrivée : monte de 16 px en fondu.
const monte = keyframes`from { opacity: 0; transform: translateY(16px); }`

// Focus clavier sur fond ink : contour on-ink, à l'intérieur du bloc.
const focus = {
  '&.Mui-focusVisible': {
    outline: `${border.contour} solid var(--on-ink)`,
    outlineOffset: `-${border.contour}`,
  },
}

/**
 * Message bref du Design System : bloc ink, texte on-ink 15 px semi-gras,
 * radius-card, 52 px au moins. Toucher le texte ferme (`onFermer`). `action`
 * ({ libelle, onClick }) ajoute un bouton en gras à droite (44 px, radius-inner).
 * `sortant` joue le départ (180 ms) ; l'arrivée (220 ms) se joue au montage.
 * Placé et annoncé par MessageProvider.
 */
const Message = ({ texte, action, onFermer, sortant = false }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      minHeight: size.ligne,
      borderRadius: radius.card,
      bgcolor: 'ink',
      color: 'on-ink',
      pointerEvents: sortant ? 'none' : 'auto',
      animation: `${monte} ${DURATION.open}ms ${EASE}`,
      opacity: sortant ? 0 : 1,
      transform: sortant ? `translateY(${space[16]})` : 'none',
      transition: transition(['opacity', 'transform'], DURATION.close),
      ...sansMouvement(),
    }}
  >
    <ButtonBase
      onClick={onFermer}
      aria-label={`${texte}, toucher pour fermer`}
      sx={{
        ...textStyles['corps-fort'],
        flex: '1 1 0',
        minWidth: 0,
        minHeight: size.ligne,
        justifyContent: 'flex-start',
        textAlign: 'left',
        py: space[14],
        px: space[16],
        borderRadius: radius.card,
        ...focus,
      }}
    >
      {texte}
    </ButtonBase>
    {action && (
      <ButtonBase
        onClick={action.onClick}
        sx={{
          ...textStyles['corps-fort'],
          fontWeight: 700,
          flexShrink: 0,
          height: size.cible,
          px: space[14],
          mr: space[4],
          borderRadius: radius.inner,
          ...focus,
        }}
      >
        {action.libelle}
      </ButtonBase>
    )}
  </Box>
)

export default Message
