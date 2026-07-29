import { useState } from 'react'
import {
  Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { removeFromIntervals } from '../../../lib/training'
import { cleanText } from '../constants'

// Confirmation de retrait d'une seance de la montre, partagee par la vue seance
// et le dashboard. Pas de selecteur de date. Appel + loading + erreur.
const RemoveDialog = ({ open, session, onClose, onDone }) => {
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(open)

  // Reset a l'ouverture, ajuste pendant le rendu (pas d'effet).
  if (open && !wasOpen) {
    setWasOpen(true)
    setError(null)
    setRemoving(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const confirm = async () => {
    setRemoving(true)
    setError(null)
    try {
      const res = await removeFromIntervals(session.id)
      onDone?.(res)
    } catch (e) {
      setError(e.message || 'Le retrait a échoué.')
      setRemoving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !removing && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Retirer de la montre ?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: error ? 2 : 0 }}>
          {session ? `« ${cleanText(session.title)} » sera supprimée d'Intervals.icu, mais sa disparition sur la montre dépend de la prochaine synchronisation Coros et peut demander un retrait manuel dans l'app Coros.` : ''}
        </DialogContentText>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={removing} color="inherit">Annuler</Button>
        <Button onClick={confirm} disabled={removing} variant="contained" color="error">
          {removing ? <CircularProgress size={18} color="inherit" /> : 'Retirer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RemoveDialog
