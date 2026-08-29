import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Button, Chip, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx, glassSx, GLASS_BACKDROP } from '../../styles/glass'
import { getCorosStatus, startCorosOauth, disconnectCoros } from '../../lib/training'

// Coins concentriques : radius carte = inset (16 = p 2) + radius bouton (12) = 28.
const CARD_INSET = 2
const CARD_RADIUS = '28px'

// La palette du projet ne definit ni success ni error : valeurs litterales.
// Vert aligne sur primary.main, orange deja utilise pour la zone B.
const connectedColor = (t) => (t.palette.mode === 'dark' ? '#5DCAA5' : '#1D9E75')
const DISCONNECTED_COLOR = '#f97316'

// Bandeau unique de la page. Une seule source d'alerte, alimentee par le retour
// OAuth (parametre de requete), par la deconnexion et par les erreurs d'appel.
const noticeFromParam = (result) => {
  if (!result) return null
  return result === 'ok'
    ? { severity: 'success', text: 'Compte Coros connecté.' }
    : { severity: 'error', text: 'La connexion Coros a échoué. Réessaie.' }
}

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
  // Resultat du retour OAuth, lu une seule fois au montage : l'URL est nettoyee
  // juste apres pour que le message ne persiste pas au rechargement.
  const [notice, setNotice] = useState(() => noticeFromParam(searchParams.get('coros')))
  const [starting, setStarting] = useState(false)

  // Deconnexion : confirmation, appel en cours, erreur affichee dans la modale.
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState(null)

  const refresh = useCallback(() => {
    getCorosStatus()
      .then((res) => setConnected(Boolean(res?.connected)))
      .catch((e) => {
        setNotice({ severity: 'error', text: e.message || 'Impossible de lire l’état de la connexion Coros.' })
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
    setNotice(null)
    try {
      const { url } = await startCorosOauth()
      window.location.href = url
    } catch (e) {
      setNotice({ severity: 'error', text: e.message || 'Impossible de démarrer la connexion Coros.' })
      setStarting(false)
    }
  }

  const openDisconnect = () => {
    setDisconnectError(null)
    setConfirmDisconnect(true)
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setDisconnectError(null)
    try {
      const res = await disconnectCoros()
      setConnected(Boolean(res?.connected))
      setConfirmDisconnect(false)
      setNotice({ severity: 'success', text: 'Compte Coros déconnecté.' })
    } catch (e) {
      setDisconnectError(e.message || 'La déconnexion a échoué.')
    } finally {
      setDisconnecting(false)
    }
  }

  const loading = connected === null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'env(safe-area-inset-bottom, 0px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        {notice && (
          <Alert severity={notice.severity} sx={{ mt: 2 }} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
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

          {connected && (
            <Button
              variant="text"
              fullWidth
              sx={{ mt: 1, color: DISCONNECTED_COLOR }}
              disabled={starting}
              onClick={openDisconnect}
            >
              Déconnecter
            </Button>
          )}
        </Box>

      </Box>

      {/* Confirmation de deconnexion */}
      <Dialog
        open={confirmDisconnect}
        onClose={() => !disconnecting && setConfirmDisconnect(false)}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Déconnecter Coros</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Les activités ne seront plus importées. Tu pourras te reconnecter à tout moment.
          </DialogContentText>
          {disconnectError && <Alert severity="error" sx={{ mt: 2 }}>{disconnectError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDisconnect(false)} disabled={disconnecting} color="inherit">
            Annuler
          </Button>
          <Button
            onClick={handleDisconnect}
            disabled={disconnecting}
            variant="contained"
            sx={{ bgcolor: DISCONNECTED_COLOR, color: '#fff', '&:hover': { bgcolor: DISCONNECTED_COLOR } }}
          >
            {disconnecting ? <CircularProgress size={18} color="inherit" /> : 'Déconnecter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default SettingsPage
