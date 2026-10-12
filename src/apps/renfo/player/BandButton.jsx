import { Box } from '@mui/material'
import BandChip from '../BandChip'

// Pastille de bande cliquable du player : zone tactile de 44 px autour de la pastille.
const BandButton = ({ kg, bands, onClick, chipSx, label = 'Changer d\'élastique' }) => (
  <Box
    component="button"
    type="button"
    onClick={onClick}
    aria-label={label}
    sx={{
      minWidth: 44, minHeight: 44, p: 0, border: 'none', bgcolor: 'transparent', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: 'inherit',
    }}
  >
    <BandChip kg={kg} bands={bands} sx={chipSx} />
  </Box>
)

export default BandButton
