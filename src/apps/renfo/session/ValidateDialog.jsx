import { useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import BarreAttente from '../../../ui/BarreAttente'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import RpeForm from '../../../components/RpeForm'
import { emptyFeedback, toFeedbackPayload } from '../../../lib/feedback'
import { texteErreur } from '../../../lib/reseau'

/**
 * Ressenti de fin de séance. `onSubmit(feedback | null)` enregistre la séance
 * comme faite et lève une erreur en cas d'échec.
 */
const ValidateDialog = ({ open, onClose, onSubmit }) => {
  const [value, setValue] = useState(emptyFeedback())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)
  const attente = useFinAttente(busy)

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
      setError(texteErreur(e, "La validation n'a pas abouti. Réessaie."))
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
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      {attente.visible
        ? (
          <Box sx={{ px: 3, pb: 2 }}>
            <BarreAttente
              place="barre"
              phrase="Validation de ta séance"
              duree={DUREES.actionCourte}
              {...attente}
            />
          </Box>
        )
        : (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => submit(null)} color="inherit">Passer</Button>
            <Button onClick={() => submit(toFeedbackPayload(value))} variant="contained">
              Valider
            </Button>
          </DialogActions>
        )}
    </Dialog>
  )
}

export default ValidateDialog
