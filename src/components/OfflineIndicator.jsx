import { Box, Typography } from '@mui/material'
import CloudOff from '@mui/icons-material/CloudOff'
import { useOnline } from '../hooks/useOnline'

// Pastille discrète en bas d'écran, visible partout tant que l'appareil est hors ligne.
const OfflineIndicator = () => {
  const online = useOnline()
  if (online) return null
  return (
    <Box
      role="status"
      sx={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 1250,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.5, py: 0.5, borderRadius: 999, pointerEvents: 'none',
        bgcolor: 'text.primary', color: 'background.default', opacity: 0.85,
        viewTransitionName: 'offline-indicator',
      }}
    >
      <CloudOff sx={{ fontSize: 14 }} />
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 500 }}>Hors ligne</Typography>
    </Box>
  )
}

export default OfflineIndicator
