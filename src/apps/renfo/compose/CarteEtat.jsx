import { Box, Typography } from '@mui/material'
import { border, space } from '../../../styles/tokens'
import Carte from '../../../ui/Carte'

/** Carte de préparation ou d'échec d'une séance : intensité, titre, filet, puis l'état (children). */
const CarteEtat = ({ resume, titre, children }) => (
  <Carte sx={{ gap: space[12] }}>
    <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{resume}</Typography>
    <Typography variant="titre-section" component="p">{titre}</Typography>
    <Box sx={{ borderTop: `${border.filet} solid`, borderColor: 'line', display: 'flex', flexDirection: 'column', gap: space[2], pt: space[12] }}>
      {children}
    </Box>
  </Carte>
)

export default CarteEtat
