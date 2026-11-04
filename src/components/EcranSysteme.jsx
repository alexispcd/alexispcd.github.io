import { Box } from '@mui/material'
import { space } from '../styles/tokens'
import CarteSysteme from './CarteSysteme'

// Écran système plein écran : la CarteSysteme centrée, comme la connexion.
const EcranSysteme = (props) => (
  <Box sx={{
    height: '100dvh',
    bgcolor: 'background.default',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    px: space[16],
    pb: '60px',
    boxSizing: 'border-box',
  }}>
    <CarteSysteme {...props} />
  </Box>
)

export default EcranSysteme
