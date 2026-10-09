import { useState } from 'react'
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import RpeForm from '../../../components/RpeForm'
import { emptyFeedback, toFeedbackPayload } from '../../../lib/feedback'

/**
 * Ressenti de fin de séance. `onSubmit(feedback | null)` enregistre la séance
 * comme faite et lève une erreur lisible en cas d'échec. Demande le réseau.
 */
const ValidateDialog = ({ open, online, onClose, onSubmit }) => {
  const [value, setValue] = useState(emptyFeedback())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValue(emptyFeedback())
      setBusy(false)
      setError(null)
    }
  }

  const submit = async (feedback) => {
    setBusy(true)
    setError(null)
    try {
      await onSubmit(feedback)
    } catch (e) {
      setError(e.message || "L'enregistrement a échoué")
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Ton ressenti</DialogTitle>
      <DialogContent>
        <RpeForm value={value} onChange={setValue} />
        {!online && <Alert severity="info" sx={{ mt: 2 }}>Hors ligne : la validation demande le réseau.</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => submit(null)} disabled={busy || !online} color="inherit">Passer</Button>
        <Button onClick={() => submit(toFeedbackPayload(value))} disabled={busy || !online} variant="contained">
          {busy ? <CircularProgress size={18} color="inherit" /> : 'Valider'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ValidateDialog
