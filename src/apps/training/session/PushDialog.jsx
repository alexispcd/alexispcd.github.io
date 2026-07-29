import { useState } from 'react'
import {
  Typography, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { pushToIntervals } from '../../../lib/training'
import { cleanText } from '../constants'

// Fenetre d'envoi : d'aujourd'hui a aujourd'hui + 7 jours. Coros ne synchronise
// que la semaine a venir depuis Intervals.icu, d'ou la borne haute.
const PUSH_WINDOW_DAYS = 7
const todayISO = () => new Date().toLocaleDateString('en-CA')
const addDaysISO = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// Popup unique de confirmation d'envoi vers la montre, partagee par la vue
// seance (bouton) et le dashboard (swipe). Choix de la date + appel + loading.
const PushDialog = ({ open, session, onClose, onDone }) => {
  const [date, setDate] = useState(todayISO)
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(open)

  // Reset a l'ouverture, ajuste pendant le rendu (pas d'effet) : date du jour,
  // aucune erreur, aucun envoi en cours.
  if (open && !wasOpen) {
    setWasOpen(true)
    setDate(todayISO())
    setError(null)
    setPushing(false)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const today = todayISO()
  const maxDate = addDaysISO(today, PUSH_WINDOW_DAYS)

  const confirm = async () => {
    setPushing(true)
    setError(null)
    try {
      const res = await pushToIntervals(session.id, date)
      onDone?.(res)
    } catch (e) {
      setError(e.message || "L'envoi a échoué.")
      setPushing(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !pushing && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Envoyer vers la montre ?</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {session
            ? `« ${cleanText(session.title)} » sera ajoutée à ton calendrier Intervals.icu, qui la synchronise ensuite vers la montre.`
            : ''}
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          type="date"
          size="small"
          fullWidth
          label="Date sur la montre"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={pushing}
          slotProps={{ inputLabel: { shrink: true } }}
          inputProps={{ min: today, max: maxDate }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Coros ne récupère que la semaine à venir.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pushing} color="inherit">Annuler</Button>
        <Button onClick={confirm} disabled={pushing} variant="contained">
          {pushing ? <CircularProgress size={18} color="inherit" /> : 'Envoyer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PushDialog
