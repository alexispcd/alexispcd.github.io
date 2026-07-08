import { Box, Typography } from '@mui/material'
import Construction from '@mui/icons-material/Construction'
import { HEADER_HEIGHT } from '../../components/AppHeader'

// Placeholder des écrans à venir (wizard : phase 3 ; séance : phase 2).
const TrainingPlaceholder = ({ label = 'Bientôt' }) => (
  <Box sx={{
    height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: 1.5, px: 3, pt: `${HEADER_HEIGHT}px`, textAlign: 'center',
  }}>
    <Construction sx={{ fontSize: 40, color: 'text.disabled' }} />
    <Typography variant="h6" fontWeight={700}>{label}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
      Cet écran arrive dans une prochaine version.
    </Typography>
  </Box>
)

export default TrainingPlaceholder
