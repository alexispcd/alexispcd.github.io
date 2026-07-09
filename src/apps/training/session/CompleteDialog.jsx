import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, CircularProgress, Alert,
  Dialog, DialogContent, DialogActions,
} from '@mui/material'
import DirectionsRun from '@mui/icons-material/DirectionsRun'
import CheckCircle from '@mui/icons-material/CheckCircle'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { corosMatch, completeSession } from '../../../lib/training'
import { formatKm, formatGoalTime, formatPace } from '../constants'

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '·'

const candidateSub = (c) => [
  formatKm(c.distance_m) ? `${formatKm(c.distance_m)} km` : null,
  formatGoalTime(c.duration_sec),
  c.avg_pace_sec ? `${formatPace(c.avg_pace_sec)}/km` : null,
].filter(Boolean).join(' · ')

/**
 * Flux "Valider & lier Coros" : recherche des activités candidates, sélection,
 * puis complétion (import laps + analyse). onDone reçoit la séance mise à jour.
 */
const CompleteDialog = ({ open, sessionId, onClose, onDone }) => {
  const [phase, setPhase] = useState('matching') // matching | choose | completing | done
  const [candidates, setCandidates] = useState([])
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)
  const [withCoros, setWithCoros] = useState(true) // pour le message de complétion

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPhase('matching')
    setCandidates([])
    setSelected(null)
    setError(null)
    corosMatch(sessionId)
      .then(({ candidates: list }) => {
        if (cancelled) return
        const arr = list ?? []
        setCandidates(arr)
        setSelected(arr[0]?.labelId ?? null)
        setError(arr.length ? null : 'Aucune activité Coros trouvée autour de cette date.')
        setPhase('choose')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message || 'Coros indisponible pour le moment.')
        setPhase('choose')
      })
    return () => { cancelled = true }
  }, [open, sessionId])

  const runComplete = async (labelId) => {
    setWithCoros(Boolean(labelId))
    setPhase('completing')
    setError(null)
    try {
      const { session } = await completeSession(sessionId, labelId)
      onDone(session)
    } catch (e) {
      setError(e.message || 'La validation a échoué.')
      setPhase('choose')
    }
  }

  const busy = phase === 'matching' || phase === 'completing'

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogContent sx={{ pt: 3 }}>
        {phase === 'matching' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
            <CircularProgress size={30} />
            <Typography variant="body2" color="text.secondary">Recherche de tes activités Coros…</Typography>
          </Box>
        )}

        {phase === 'completing' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3, textAlign: 'center' }}>
            <CircularProgress size={30} />
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
              {withCoros
                ? 'Import des laps et analyse en cours… cela peut prendre quelques secondes.'
                : 'Validation en cours…'}
            </Typography>
          </Box>
        )}

        {phase === 'choose' && (
          <>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Lier une activité Coros</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choisis la séance correspondante pour importer les laps et l'analyse.
            </Typography>

            {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {candidates.map((c) => {
                const on = selected === c.labelId
                return (
                  <Box
                    key={c.labelId}
                    onClick={() => setSelected(c.labelId)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: 'pointer',
                      borderRadius: 3, border: '1px solid',
                      borderColor: on ? 'primary.main' : 'divider',
                      bgcolor: on ? 'primary.light' : 'transparent',
                    }}
                  >
                    <DirectionsRun sx={{ color: on ? 'primary.main' : 'text.secondary', fontSize: 22 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {fmtDate(c.date)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {candidateSub(c)}
                      </Typography>
                    </Box>
                    {on && <CheckCircle sx={{ color: 'primary.main', fontSize: 20 }} />}
                  </Box>
                )
              })}
            </Box>
          </>
        )}
      </DialogContent>

      {!busy && (
        <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={onClose} color="inherit">Annuler</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => runComplete(null)} color="inherit">Valider sans Coros</Button>
          {candidates.length > 0 && (
            <Button onClick={() => runComplete(selected)} variant="contained" disabled={!selected}>
              Valider
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  )
}

export default CompleteDialog
