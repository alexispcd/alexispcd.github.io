import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import { DirectionsRun, ErrorOutlined } from '@mui/icons-material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { getActivePlan, generatePlan, subscribeToPlan } from '../../lib/training'
import PlanWizard from './wizard/PlanWizard'
import PlanDashboard from './dashboard/PlanDashboard'

const TrainingPage = () => {
  const [plan, setPlan] = useState(undefined)
  const [error, setError] = useState(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [generatingPlanId, setGeneratingPlanId] = useState(null)
  const [generateError, setGenerateError] = useState(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => {
    getActivePlan()
      .then(setPlan)
      .catch(err => { setError(err.message); setPlan(null) })
  }, [])

  useEffect(() => {
    return () => { unsubscribeRef.current?.() }
  }, [])

  const handleGenerate = async (context) => {
    setWizardOpen(false)
    setGenerateError(null)

    let planId
    try {
      const result = await generatePlan(context)
      planId = result.planId
    } catch (err) {
      setGenerateError(err.message)
      return
    }

    setGeneratingPlanId(planId)

    unsubscribeRef.current = subscribeToPlan(planId, async (status, errMsg) => {
      unsubscribeRef.current = null
      setGeneratingPlanId(null)
      if (status === 'ready') {
        try {
          const updated = await getActivePlan()
          setPlan(updated)
        } catch {
          setError('Plan généré mais erreur au chargement, recharge la page.')
        }
      } else {
        setGenerateError(errMsg ?? 'Erreur lors de la génération du plan.')
      }
    })
  }

  const handleRetry = () => {
    setGenerateError(null)
    setWizardOpen(true)
  }

  // Écran wizard
  if (wizardOpen) {
    return <PlanWizard onGenerate={handleGenerate} />
  }

  // Écran génération en cours
  if (generatingPlanId) {
    return (
      <Box sx={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pt: `${HEADER_HEIGHT}px`, px: 3, gap: 3, textAlign: 'center',
      }}>
        <CircularProgress size={40} thickness={3} />
        <Box>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            Génération de ton plan en cours...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Claude analyse tes données Coros et construit ton plan. Tu peux fermer et revenir, ça continue en arrière-plan.
          </Typography>
        </Box>
      </Box>
    )
  }

  // Plan prêt → dashboard
  if (plan?.generation_status === 'ready') {
    return <PlanDashboard plan={plan} />
  }

  // Plan en génération (chargé depuis la BDD, pas de wizard en cours)
  if (plan?.generation_status === 'generating') {
    return (
      <Box sx={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pt: `${HEADER_HEIGHT}px`, px: 3, gap: 3, textAlign: 'center',
      }}>
        <CircularProgress size={40} thickness={3} />
        <Box>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            Génération de ton plan en cours...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Claude analyse tes données Coros et construit ton plan. Tu peux fermer et revenir, ça continue en arrière-plan.
          </Typography>
        </Box>
      </Box>
    )
  }

  // États vides / erreur
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

        {generateError && (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, py: 8, textAlign: 'center',
          }}>
            <ErrorOutlined sx={{ fontSize: 48, color: 'error.main' }} />
            <Box>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Erreur lors de la génération
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {generateError}
              </Typography>
            </Box>
            <Button variant="contained" disableElevation onClick={handleRetry}>
              Réessayer
            </Button>
          </Box>
        )}

        {plan === null && !error && !generateError && (
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

      </Box>
    </Box>
  )
}

export default TrainingPage
