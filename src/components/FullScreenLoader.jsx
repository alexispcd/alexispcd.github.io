import { Box, CircularProgress } from '@mui/material'

// Loader plein écran centré : session, accès et premier chargement de route.
const FullScreenLoader = () => (
  <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
    <CircularProgress size={32} sx={{ color: 'primary.main' }} />
  </Box>
)

export default FullScreenLoader
