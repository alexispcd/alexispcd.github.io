import { Box } from '@mui/material'
import { radius } from '../../../styles/tokens'

/**
 * Barre de 5 px qui suit un décompte (exercice chronométré, pause) : part écoulée en
 * `ink` sur `track`, sans transition, la boucle du décompte la met à jour. Décorative :
 * le chiffre porte l'information.
 */
const BarreDecompte = ({ fraction = 0, sx }) => (
  <Box aria-hidden="true" sx={{ width: '100%', height: '5px', flexShrink: 0, borderRadius: radius.pill, bgcolor: 'track', overflow: 'hidden', ...sx }}>
    <Box sx={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, height: '100%', bgcolor: 'ink' }} />
  </Box>
)

export default BarreDecompte
