import { Box, Typography, Button } from '@mui/material'
import FullScreenLoader from './FullScreenLoader'
import { useAppCtx } from '../lib/context'

// Bloque l'app tant que les droits du compte connecté ne sont pas chargés :
// évite une home vide ou une route refusée à tort pendant le chargement.
const AccessGate = ({ children }) => {
  const { access } = useAppCtx()

  if (!access) return <FullScreenLoader />

  if (access.error) {
    return (
      <Box sx={{
        height: '100dvh', bgcolor: 'background.default',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 2, px: 4, textAlign: 'center',
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
          Impossible de charger tes accès. Vérifie ta connexion puis recharge.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()} sx={{ textTransform: 'none' }}>
          Recharger
        </Button>
      </Box>
    )
  }

  return children
}

export default AccessGate
