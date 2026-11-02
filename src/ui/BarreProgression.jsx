import { Box } from '@mui/material'
import { keyframes } from '@emotion/react'
import { radius } from '../styles/tokens'
import { DURATION, EASE, transition } from '../styles/motion'
import { sansMouvement } from './appui'

// Remplissage à l'arrivée de l'écran : depuis 0 jusqu'à la largeur posée.
const arrivee = keyframes`from { width: 0; }`

/**
 * Barre fine d'une part réalisée d'un total : fond track, remplissage ink, neutre.
 * Toujours accompagnée de la valeur en chiffres (voir useValeurAnimee, même durée).
 * - widget : 5 px au lieu de 6.
 * - lieeEtat : 220 ms (séance marquée faite) au lieu de 400.
 * Se remplit à l'arrivée et à chaque changement, depuis la valeur d'avant ; rien
 * avec « Réduire les animations ».
 */
const BarreProgression = ({ valeur, max = 100, widget = false, lieeEtat = false, label, sx }) => {
  const part = max > 0 ? Math.min(1, Math.max(0, valeur / max)) : 0
  const duree = lieeEtat ? DURATION.open : DURATION.fill
  return (
    <Box
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valeur}
      aria-label={label}
      sx={{
        height: widget ? '5px' : '6px',
        borderRadius: radius.pill,
        bgcolor: 'track',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        sx={{
          height: '100%',
          width: `${part * 100}%`,
          borderRadius: radius.pill,
          bgcolor: 'ink',
          transition: transition('width', duree),
          animation: `${arrivee} ${duree}ms ${EASE}`,
          ...sansMouvement(),
        }}
      />
    </Box>
  )
}

export default BarreProgression
