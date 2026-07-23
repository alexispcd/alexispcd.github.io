import { useState, useEffect } from 'react'
import {
  Box, Typography, Button, CircularProgress, Alert,
  Dialog, DialogContent, DialogActions,
} from '@mui/material'
import DirectionsRun from '@mui/icons-material/DirectionsRun'
import CheckBox from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlank from '@mui/icons-material/CheckBoxOutlineBlank'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { corosMatch, completeSession } from '../../../lib/training'
import { formatKm, formatGoalTime, formatPace } from '../constants'
import RpeForm from './RpeForm'
import { emptyFeedback, toFeedbackPayload } from './feedback'

// Cohérent avec le garde-fou serveur (3 activités max par complétion).
const MAX_ACTIVITIES = 3

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '·'

const candidateSub = (c) => [
  formatKm(c.distance_m) ? `${formatKm(c.distance_m)} km` : null,
  formatGoalTime(c.duration_sec),
  c.avg_pace_sec ? `${formatPace(c.avg_pace_sec)}/km` : null,
].filter(Boolean).join(' · ')

/**
 * Flux "Valider & lier Coros" : recherche des activités candidates, sélection
 * (une ou plusieurs, jusqu'à 3), puis complétion (import laps concaténés +
 * analyse). onDone reçoit la séance mise à jour.
 */
const CompleteDialog = ({ open, sessionId, onClose, onDone }) => {
  const [phase, setPhase] = useState('matching') // matching | choose | feedback | completing | done
  const [candidates, setCandidates] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [error, setError] = useState(null)
  const [withCoros, setWithCoros] = useState(true) // pour le message de complétion
  const [pendingLabels, setPendingLabels] = useState(null) // activités choisies, en attente du ressenti
  const [feedback, setFeedback] = useState(emptyFeedback())

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setPhase('matching')
    setCandidates([])
    setSelectedIds([])
    setError(null)
    setPendingLabels(null)
    setFeedback(emptyFeedback())
    corosMatch(sessionId)
      .then(({ candidates: list }) => {
        if (cancelled) return
        const arr = list ?? []
        setCandidates(arr)
        // Présélection du premier candidat (le plus proche de la date).
        setSelectedIds(arr[0]?.labelId ? [arr[0].labelId] : [])
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

  // Coche / décoche un candidat, dans la limite de MAX_ACTIVITIES.
  const toggle = (labelId) => {
    setSelectedIds((prev) => {
      if (prev.includes(labelId)) return prev.filter((id) => id !== labelId)
      if (prev.length >= MAX_ACTIVITIES) return prev
      return [...prev, labelId]
    })
  }

  // Étape 1 : la ou les activités (ou leur absence) sont choisies → ressenti.
  const goToFeedback = (labels) => {
    setPendingLabels(labels)
    setError(null)
    setPhase('feedback')
  }

  // Étape 2 : envoi effectif avec ou sans ressenti.
  const runComplete = async (fb) => {
    setWithCoros(Boolean(pendingLabels?.length))
    setPhase('completing')
    setError(null)
    try {
      const { session } = await completeSession(sessionId, pendingLabels, fb)
      onDone(session)
    } catch (e) {
      setError(e.message || 'La validation a échoué.')
      setPhase('feedback')
    }
  }

  const busy = phase === 'matching' || phase === 'completing'

  // Récapitulatif quand au moins deux activités sont sélectionnées.
  const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.labelId))
  const totalDistance = selectedCandidates.reduce((sum, c) => sum + (c.distance_m || 0), 0)
  const totalDuration = selectedCandidates.reduce((sum, c) => sum + (c.duration_sec || 0), 0)

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
              Choisis la ou les activités correspondantes. Sélectionnes-en plusieurs si
              la séance a été enregistrée en morceaux.
            </Typography>

            {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {candidates.map((c) => {
                const on = selectedIds.includes(c.labelId)
                const disabled = !on && selectedIds.length >= MAX_ACTIVITIES
                const CheckIcon = on ? CheckBox : CheckBoxOutlineBlank
                return (
                  <Box
                    key={c.labelId}
                    onClick={() => !disabled && toggle(c.labelId)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
                      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
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
                    <CheckIcon sx={{ color: on ? 'primary.main' : 'text.disabled', fontSize: 22 }} />
                  </Box>
                )
              })}
            </Box>

            {selectedIds.length >= 2 && (
              <Box sx={{
                mt: 2, px: 1.75, py: 1.5, borderRadius: '14px',
                border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
              }}>
                <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {selectedIds.length} activités · {formatKm(totalDistance) ?? '0'} km · {formatGoalTime(totalDuration) ?? '·'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Les laps seront enchaînés dans l'ordre chronologique.
                </Typography>
              </Box>
            )}
          </>
        )}

        {phase === 'feedback' && (
          <>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>Ton ressenti</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Optionnel, mais ça affine l'analyse et l'adaptation des prochaines séances.
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <RpeForm value={feedback} onChange={setFeedback} />
          </>
        )}
      </DialogContent>

      {phase === 'choose' && (
        <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={onClose} color="inherit">Annuler</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => goToFeedback(null)} color="inherit">Valider sans Coros</Button>
          {candidates.length > 0 && (
            <Button onClick={() => goToFeedback(selectedIds)} variant="contained" disabled={!selectedIds.length}>
              Continuer
            </Button>
          )}
        </DialogActions>
      )}

      {phase === 'feedback' && (
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => runComplete(null)} color="inherit">Passer</Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => runComplete(toFeedbackPayload(feedback))} variant="contained">
            Valider
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}

export default CompleteDialog
