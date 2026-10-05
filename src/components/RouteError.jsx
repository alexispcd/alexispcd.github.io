import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { Box, Typography, Button } from '@mui/material'

// Messages des navigateurs quand un chunk lazy est introuvable, typiquement après
// un nouveau déploiement qui a supprimé l'ancien hash de GitHub Pages.
const CHUNK_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i

const RouteError = () => {
  const error = useRouteError()
  const navigate = useNavigate()
  // URL inconnue ou module désactivé : recharger ne changerait rien, on renvoie à l'accueil.
  const isNotFound = isRouteErrorResponse(error) && error.status === 404
  const isChunkError = CHUNK_ERROR.test(error?.message ?? '')

  const title = isNotFound ? 'Page introuvable'
    : isChunkError ? 'Nouvelle version disponible'
    : 'Une erreur est survenue'
  const message = isNotFound ? 'Cette page n\'existe pas ou n\'est plus disponible.'
    : isChunkError ? 'Le Cairn a été mis à jour. Recharge la page pour continuer.'
    : 'Cette page n\'a pas pu s\'afficher. Recharge pour réessayer.'

  return (
    <Box sx={{
      height: '100dvh',
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      px: 4,
      textAlign: 'center',
    }}>
      <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic', fontSize: '1.5rem', fontWeight: 400 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        {message}
      </Typography>
      <Button
        variant="contained"
        onClick={isNotFound ? () => navigate('/') : () => window.location.reload()}
        sx={{ textTransform: 'none', mt: 1 }}
      >
        {isNotFound ? 'Retour à l\'accueil' : 'Recharger'}
      </Button>
    </Box>
  )
}

export default RouteError
