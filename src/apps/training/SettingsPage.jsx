import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Button, Chip, CircularProgress, Alert } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import { getCorosStatus, startCorosOauth } from '../../lib/training'

// Coins concentriques : radius carte = inset (16 = p 2) + radius bouton (12) = 28.
const CARD_INSET = 2
const CARD_RADIUS = '28px'

// La palette du projet ne definit ni success ni error : valeurs litterales.
// Vert aligne sur primary.main, orange deja utilise pour la zone B.
const connectedColor = (t) => (t.palette.mode === 'dark' ? '#5DCAA5' : '#1D9E75')
const DISCONNECTED_COLOR = '#f97316'

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, px: 0.5 }}
  >
    {children}
  </Typography>
)

/**
 * Reglages Training. Pour l'instant une seule section : la connexion OAuth Coros,
 * qui se fait dans le navigateur systeme (Coros refuse l'iframe). Le retour se fait
 * sur cette page avec ?coros=ok ou ?coros=error.
 */
const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connected, setConnected] = useState(null) // null = chargement
  const [error, setError] = useState(null)
  // Resultat du retour OAuth, lu une seule fois au montage : l'URL est nettoyee
  // juste apres pour que le message ne persiste pas au rechargement.
  const [notice, setNotice] = useState(() => searchParams.get('coros'))
  const [starting, setStarting] = useState(false)

  const refresh = useCallback(() => {
    getCorosStatus()
      .then((res) => setConnected(Boolean(res?.connected)))
      .catch((e) => {
        setError(e.message || 'Impossible de lire l’état de la connexion Coros.')
        setConnected(false)
      })
  }, [])

  // Chargement initial + rafraichissement quand l'utilisateur revient dans la PWA
  // apres s'etre authentifie dans le navigateur.
  useEffect(() => {
    refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refresh])

  useEffect(() => {
    if (!searchParams.get('coros')) return
    const next = new URLSearchParams(searchParams)
    next.delete('coros')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleConnect = async () => {
    setStarting(true)
    setError(null)
    try {
      const { url } = await startCorosOauth()
      window.location.href = url
    } catch (e) {
      setError(e.message || 'Impossible de démarrer la connexion Coros.')
      setStarting(false)
    }
  }

  const loading = connected === null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'env(safe-area-inset-bottom, 0px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        {notice === 'ok' && (
          <Alert severity="success" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
            Compte Coros connecté.
          </Alert>
        )}
        {notice && notice !== 'ok' && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setNotice(null)}>
            La connexion Coros a échoué. Réessaie.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>
        )}

        <SectionLabel>Connexions</SectionLabel>

        <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: CARD_INSET }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body1" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>Coros</Typography>
            {loading
              ? <CircularProgress size={18} />
              : (
                <Chip
                  size="small"
                  label={connected ? 'Connecté' : 'Déconnecté'}
                  sx={{
                    fontWeight: 600,
                    color: connected ? connectedColor : DISCONNECTED_COLOR,
                    borderColor: connected ? connectedColor : DISCONNECTED_COLOR,
                    border: '1px solid',
                    bgcolor: 'transparent',
                  }}
                />
              )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Import des activités et des laps
          </Typography>

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={loading || starting}
            onClick={handleConnect}
          >
            {starting
              ? <CircularProgress size={18} color="inherit" />
              : connected ? 'Reconnecter Coros' : 'Connecter Coros'}
          </Button>
        </Box>

      </Box>
    </Box>
  )
}

export default SettingsPage
