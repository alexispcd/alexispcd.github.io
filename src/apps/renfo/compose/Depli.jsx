import { Box, Collapse } from '@mui/material'
import { keyframes } from '@emotion/react'
import { DURATION, EASE, transition } from '../../../styles/motion'
import { sansMouvement } from '../../../ui/appui'
import { useReduireAnimations } from '../../../ui/useReduireAnimations'

// Fondu d'une ligne qui arrive (ajout) : la hauteur s'ouvre, le contenu apparaît.
const fondu = keyframes`from { opacity: 0; } to { opacity: 1; }`

/**
 * Contenu qui s'ouvre en hauteur et apparaît en fondu (220 ms), se referme et
 * s'efface (180 ms) : accordéon, ligne ajoutée ou retirée. Rien de tout cela avec
 * « Réduire les animations ».
 * - appear : anime aussi la première arrivée (ligne ajoutée).
 * - onExited : appelé une fois refermé (la ligne retirée quitte alors la liste).
 */
const Depli = ({ ouvert, appear = false, onExited, children }) => {
  const reduire = useReduireAnimations()
  return (
    <Collapse
      in={ouvert}
      appear={appear}
      timeout={reduire ? 0 : { enter: DURATION.open, exit: DURATION.close }}
      easing={EASE}
      onExited={onExited}
      unmountOnExit
    >
      <Box
        sx={{
          opacity: ouvert ? 1 : 0,
          transition: transition('opacity', ouvert ? DURATION.open : DURATION.close),
          animation: appear ? `${fondu} ${DURATION.open}ms ${EASE}` : undefined,
          ...sansMouvement(),
        }}
      >
        {children}
      </Box>
    </Collapse>
  )
}

export default Depli
