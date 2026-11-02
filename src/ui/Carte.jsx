import { Box } from '@mui/material'
import { radius, space } from '../styles/tokens'

/**
 * Carte du Design System : fond surface sur bg, radius-card, marge 14 px, sans ombre
 * ni bordure. `sansMarge` pour une carte de lignes : chaque ligne porte ses 16 px et
 * son calque d'appui va jusqu'aux bords, coupé par les coins de la carte.
 */
const Carte = ({ sansMarge = false, children, sx, ...rest }) => (
  <Box
    sx={{
      bgcolor: 'surface',
      borderRadius: radius.card,
      p: sansMarge ? 0 : space[14],
      overflow: sansMarge ? 'hidden' : undefined,
      display: 'flex',
      flexDirection: 'column',
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
)

export default Carte
