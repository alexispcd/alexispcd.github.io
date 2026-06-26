import { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Typography, CircularProgress, Snackbar, Alert } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { generatePlan, regeneratePlan, subscribeToPlan, getPlanById } from '../../lib/training'
import PlanList from './PlanList'
import PlanWizard from './wizard/PlanWizard'
import PlanDashboard from './dashboard/PlanDashboard'

const TrainingPage = () => {
  // 'list' | 'dashboard' | 'wizard' | 'generating'
  const [view, setView]               = useState('list')
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [readOnly, setReadOnly]         = useState(false)
  const [generateError, setGenerateError] = useState(null)
  const [listRefreshKey, setListRefreshKey] = useState(0)
  const [generatingMode, setGeneratingMode] = useState('plan') // 'plan' | 'regen'
  const [flashError, setFlashError] = useState(null)
  const unsubscribeRef = useRef(null)

  useEffect(() => () => { unsubscribeRef.current?.() }, [])

  const refreshList = useCallback(() => setListRefreshKey(k => k + 1), [])

  const handleSelectPlan = useCallback((plan, isReadOnly = false) => {
    // Plan encore en cours de génération → ré-abonnement
    if (plan.generation_status === 'generating') {
      setView('generating')
      unsubscribeRef.current = subscribeToPlan(plan.id, async (status, errMsg) => {
        unsubscribeRef.current = null
        if (status === 'ready') {
          try {
            const updated = await getPlanById(plan.id)
            setSelectedPlan(updated)
            setReadOnly(false)
            setView('dashboard')
          } catch {
            refreshList()
            setView('list')
          }
        } else {
          setGenerateError(errMsg ?? 'Erreur lors de la génération du plan.')
          setView('list')
        }
      })
      return
    }
    setSelectedPlan(plan)
    setReadOnly(isReadOnly)
    setView('dashboard')
  }, [refreshList])

  const handleGenerate = async (context) => {
    setView('generating')
    setGenerateError(null)

    let planId
    try {
      const result = await generatePlan(context)
      planId = result.planId
    } catch (err) {
      setGenerateError(err.message)
      setView('list')
      return
    }

    unsubscribeRef.current = subscribeToPlan(planId, async (status, errMsg) => {
      unsubscribeRef.current = null
      if (status === 'ready') {
        try {
          const plan = await getPlanById(planId)
          setSelectedPlan(plan)
          setReadOnly(false)
          setView('dashboard')
        } catch {
          refreshList()
          setView('list')
        }
      } else {
        setGenerateError(errMsg ?? 'Erreur lors de la génération du plan.')
        setView('list')
      }
    })
  }

  const handleRegeneratePlan = useCallback(async (planId) => {
    setGeneratingMode('regen')
    setView('generating')
    setFlashError(null)

    try {
      await regeneratePlan(planId)
    } catch (err) {
      setGeneratingMode('plan')
      setFlashError(err.message)
      setView('dashboard')
      return
    }

    unsubscribeRef.current = subscribeToPlan(planId, async (status, errMsg) => {
      unsubscribeRef.current = null
      setGeneratingMode('plan')
      if (status === 'ready') {
        try {
          const plan = await getPlanById(planId)
          setSelectedPlan(plan)
          setReadOnly(false)
          setView('dashboard')
        } catch {
          refreshList()
          setView('list')
        }
      } else {
        setFlashError(errMsg ?? 'Erreur lors de la régénération du plan.')
        setView('dashboard')
      }
    })
  }, [refreshList])

  const handleBackToList = useCallback(() => {
    refreshList()
    setSelectedPlan(null)
    setView('list')
  }, [refreshList])

  if (view === 'wizard') {
    return <PlanWizard onGenerate={handleGenerate} onBack={handleBackToList} />
  }

  if (view === 'generating') {
    const isRegen = generatingMode === 'regen'
    return (
      <Box sx={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pt: `${HEADER_HEIGHT}px`, px: 3, gap: 3, textAlign: 'center',
      }}>
        <CircularProgress size={40} thickness={3} />
        <Box>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            {isRegen ? 'Régénération du plan en cours...' : 'Génération de ton plan en cours...'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isRegen
              ? 'Claude recalibre les séances restantes selon ta situation actuelle. Tu peux fermer et revenir, ça continue en arrière-plan.'
              : 'Claude analyse tes données Coros et construit ton plan. Tu peux fermer et revenir, ça continue en arrière-plan.'
            }
          </Typography>
        </Box>
      </Box>
    )
  }

  if (view === 'dashboard' && selectedPlan) {
    return (
      <>
        <PlanDashboard
          plan={selectedPlan}
          readOnly={readOnly}
          onBack={handleBackToList}
          onRegeneratePlan={handleRegeneratePlan}
        />
        <Snackbar
          open={Boolean(flashError)}
          autoHideDuration={6000}
          onClose={() => setFlashError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity="error" onClose={() => setFlashError(null)} sx={{ width: '100%' }}>
            {flashError}
          </Alert>
        </Snackbar>
      </>
    )
  }

  return (
    <PlanList
      refreshKey={listRefreshKey}
      generateError={generateError}
      onClearError={() => setGenerateError(null)}
      onSelectPlan={handleSelectPlan}
      onNewPlan={() => { setGenerateError(null); setView('wizard') }}
    />
  )
}

export default TrainingPage
