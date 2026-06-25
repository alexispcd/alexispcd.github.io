import { useState, useEffect } from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import { DirectionsRun } from '@mui/icons-material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { getActivePlan } from '../../lib/training'
import PlanWizard from './wizard/PlanWizard'

const TrainingPage = () => {
  const [plan, setPlan] = useState(undefined)
  const [error, setError] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    getActivePlan()
      .then(setPlan)
      .catch(err => { setError(err.message); setPlan(null) })
  }, [])

  if (wizardOpen) {
    return (
      <PlanWizard
        onGenerate={(context) => {
          // TODO: appeler Edge Function generate-plan
          console.log('generate plan', context)
          setWizardOpen(false)
        }}
      />
    )
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: 3 }}>

        {plan === undefined && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error" sx={{ textAlign: 'center', py: 8 }}>
            {error}
          </Typography>
        )}

        {plan === null && !error && (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, py: 8, textAlign: 'center',
          }}>
            <DirectionsRun sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Box>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Aucun plan actif
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crée un plan pour commencer à suivre ton entraînement.
              </Typography>
            </Box>
            <Button variant="contained" disableElevation onClick={() => setWizardOpen(true)}>
              Créer un plan
            </Button>
          </Box>
        )}

        {plan && (
          <Box>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Plan actif
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {plan.race_name ?? 'Sans nom'} — {plan.race_distance}
            </Typography>
          </Box>
        )}

      </Box>
    </Box>
  )
}

export default TrainingPage
