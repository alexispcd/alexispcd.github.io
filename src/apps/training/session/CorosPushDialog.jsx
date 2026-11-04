import { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Box, Typography, Button, Alert, Link,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import BarreAttente from '../../../ui/BarreAttente'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import { pushToCoros, getCorosStatus } from '../../../lib/training'
import { setTransitionDirection } from '../../../lib/viewTransition'
import { texteErreur } from '../../../lib/reseau'
import { cleanText, todayISO, addDaysISO, COROS_PUSH_WINDOW_DAYS } from '../constants'

// Date proposée : la date prévue, ramenée à aujourd'hui si elle est passée, et
// bornée à la fenêtre Coros.
const defaultDate = (session, today, maxDate) => {
  const planned = session?.scheduled_date
  if (!planned || planned < today) return today
  return planned > maxDate ? maxDate : planned
}

const loadConnected = async () => {
  try {
    const { connected } = await getCorosStatus()
    return Boolean(connected)
  } catch {
    // Statut illisible : on laisse tenter l'envoi, le serveur tranchera.
    return true
  }
}

// Popup unique d'envoi vers la montre, partagée par la vue séance (bouton) et
// le dashboard (swipe). Choix de la date + appel + chargement. Si la séance est
// déjà sur la montre, prévient que l'ancienne copie restera dans l'app Coros.
const CorosPushDialog = ({ open, session, onClose, onDone }) => {
  const [today, setToday] = useState(todayISO)
  const [date, setDate] = useState('')
  const [pushing, setPushing] = useState(false)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(null) // null = vérification en cours
  const [wasOpen, setWasOpen] = useState(false)

  // Reset à l'ouverture, ajusté pendant le rendu (pas d'effet).
  if (open && !wasOpen) {
    const t = todayISO()
    setWasOpen(true)
    setToday(t)
    setDate(defaultDate(session, t, addDaysISO(t, COROS_PUSH_WINDOW_DAYS)))
    setError(null)
    setPushing(false)
    setConnected(null)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadConnected().then((c) => { if (!cancelled) setConnected(c) })
    return () => { cancelled = true }
  }, [open])

  const attenteEtat = useFinAttente(Boolean(open) && connected === null)
  const attenteEnvoi = useFinAttente(pushing)

  const maxDate = addDaysISO(today, COROS_PUSH_WINDOW_DAYS)
  const alreadyOnWatch = Boolean(session?.coros_workout_id)
  const dateValid = Boolean(date) && date >= today && date <= maxDate

  const confirm = async () => {
    setPushing(true)
    setError(null)
    try {
      const res = await pushToCoros(session.id, date)
      onDone?.(res)
    } catch (e) {
      if (e.body?.code === 'coros_not_connected') setConnected(false)
      else setError(texteErreur(e, 'L\'envoi sur ta montre n\'a pas abouti. Réessaie.'))
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
      <DialogTitle sx={{ fontWeight: 700 }}>
        {alreadyOnWatch ? 'Envoyer à une autre date ?' : 'Envoyer vers la montre ?'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {session ? `« ${cleanText(session.title)} » sera ajoutée à ton calendrier Coros, puis synchronisée sur la montre.` : ''}
        </DialogContentText>
        {attenteEtat.visible && (
          <Box sx={{ mb: 2 }}>
            <BarreAttente place="section" duree={DUREES.sources} {...attenteEtat} />
          </Box>
        )}
        {alreadyOnWatch && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            L'ancienne copie restera sur ta montre : supprime-la dans l'app Coros.
          </Alert>
        )}
        {connected === false && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Coros n'est pas connecté.{' '}
            <Link component={RouterLink} to="/training/settings" viewTransition onClick={() => { setTransitionDirection('forward'); onClose() }}>
              Connecter Coros dans les réglages
            </Link>
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          type="date"
          size="small"
          fullWidth
          label="Date sur la montre"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={pushing || connected === false}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: today, max: maxDate } }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Entre aujourd'hui et dans 90 jours.
        </Typography>
      </DialogContent>
      {attenteEnvoi.visible
        ? (
          <Box sx={{ px: 3, pb: 2 }}>
            <BarreAttente
              place="barre"
              phrase="Envoi sur ta montre"
              duree={DUREES.envoiMontre}
              {...attenteEnvoi}
            />
          </Box>
        )
        : (
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} color="inherit">Annuler</Button>
            <Button
              onClick={confirm}
              disabled={!dateValid || connected !== true}
              variant="contained"
            >
              Envoyer
            </Button>
          </DialogActions>
        )}
    </Dialog>
  )
}

export default CorosPushDialog
