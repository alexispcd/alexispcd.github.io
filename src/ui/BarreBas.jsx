import { useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { SPACE_BAS, border, space } from '../styles/tokens'
import { useBarreBasMessage } from './useMessage'

/**
 * Barre du bas d'une page : planche `surface` sous un filet `line`, collée en bas
 * du conteneur qui défile (position sticky), sans marge basse à calculer.
 * À poser en dernier enfant d'un conteneur flex en colonne qui défile, dont le
 * contenu prend flex '1 0 auto' : la barre reste en bas même sur une page courte.
 * - phrase : facultative, en secondaire muted centrée au-dessus des boutons (la
 *   raison d'un bouton désactivé, avec `raisonDansBarre` sur le Bouton).
 * - phraseId : id facultatif de la phrase, pour un aria-describedby sur le bouton.
 * - children : les boutons, en rangée, écartés de 8 px.
 * Le Message se pose 12 px au-dessus d'elle (useBarreBasMessage).
 */
const BarreBas = ({ phrase, phraseId, children }) => {
  const ref = useRef(null)
  useBarreBasMessage(ref)

  return (
    <Box
      ref={ref}
      sx={{
        position: 'sticky',
        bottom: 0,
        flexShrink: 0,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        gap: space[8],
        bgcolor: 'surface',
        borderTop: `${border.filet} solid`,
        borderColor: 'line',
        pt: space[12],
        px: space[16],
        pb: SPACE_BAS,
      }}
    >
      {phrase && (
        <Typography id={phraseId} variant="secondaire" sx={{ color: 'muted', textAlign: 'center' }}>
          {phrase}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: space[8] }}>
        {children}
      </Box>
    </Box>
  )
}

export default BarreBas
