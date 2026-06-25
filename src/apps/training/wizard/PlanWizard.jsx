import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, LinearProgress } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { getCorosFitness } from '../../../lib/training'
import Step1Course from './Step1Course'
import Step2Fitness from './Step2Fitness'
import Step3Objectif from './Step3Objectif'
import Step5Summary from './Step5Summary'

const STEPS = [
  { label: 'La course',      skippable: false, Component: Step1Course   },
  { label: 'Forme / VMA',   skippable: false, Component: Step2Fitness   },
  { label: 'Objectif',      skippable: false, Component: Step3Objectif  },
  { label: 'Récapitulatif', skippable: false, Component: Step5Summary   },
]

const toDateStr = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const nextMondayStr = () => {
  const d = new Date()
  const daysUntil = (1 - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + daysUntil)
  return toDateStr(d)
}

const INITIAL_CONTEXT = {
  raceName: '',
  raceType: null,
  raceDate: '',
  trailDistance: '',
  trailElevation: '',
  startDate: nextMondayStr(),
  startDateMode: 'next_monday',
  vmaSource: 'coros',
  vmaManual: '',
  fitnessSnapshot: null,
  targetPalier: null,
  targetTime: '',
  notes: '',
}

const PlanWizard = ({ onGenerate, onBack }) => {
  const [step, setStep] = useState(1)
  const [planContext, setPlanContext] = useState(INITIAL_CONTEXT)
  const [corosFitnessState, setCorosFitnessState] = useState({ status: 'loading', data: null, error: '' })
  const fetchingRef = useRef(false)

  const fetchCorosFitness = async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setCorosFitnessState({ status: 'loading', data: null, error: '' })
    try {
      const data = await getCorosFitness()
      setCorosFitnessState({ status: 'ready', data, error: '' })
      setPlanContext(prev =>
        prev.vmaSource === 'coros' ? { ...prev, fitnessSnapshot: data } : prev
      )
    } catch (err) {
      setCorosFitnessState({
        status: 'error',
        data: null,
        error: err?.message ?? 'Impossible de récupérer les données Coros.',
      })
    } finally {
      fetchingRef.current = false
    }
  }

  useEffect(() => {
    fetchCorosFitness()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateContext = (partial) => setPlanContext(prev => ({ ...prev, ...partial }))

  const handleNext = () => {
    if (step === STEPS.length) onGenerate(planContext)
    else setStep(s => s + 1)
  }
  const handleBack = () => setStep(s => s - 1)

  const { label, skippable, Component } = STEPS[step - 1]

  return (
    <Box sx={{
      height: '100%', display: 'flex', flexDirection: 'column',
      pt: `${HEADER_HEIGHT}px`, bgcolor: 'background.default',
    }}>

      {/* Barre de progression */}
      <Box sx={{ px: 2, pt: 2, pb: 1.5, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="caption" fontWeight={600} color="text.primary">
            {label}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {step} / {STEPS.length}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={(step / STEPS.length) * 100}
          sx={{ borderRadius: 1, height: 3 }}
        />
      </Box>

      {/* Contenu de l'étape */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pt: 1 }}>
        <Component
          planContext={planContext}
          updateContext={updateContext}
          corosFitnessState={corosFitnessState}
          onRetryFitness={fetchCorosFitness}
        />
      </Box>

      {/* Navigation */}
      <Box sx={{ px: 2, pt: 1, pb: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button variant="contained" fullWidth disableElevation onClick={handleNext}>
          {step === STEPS.length ? 'Générer mon plan' : 'Continuer'}
        </Button>
        {skippable && (
          <Button fullWidth onClick={() => setStep(s => s + 1)} sx={{ color: 'text.secondary' }}>
            Passer cette étape
          </Button>
        )}
        {step > 1 && (
          <Button fullWidth onClick={handleBack} sx={{ color: 'text.secondary' }}>
            Retour
          </Button>
        )}
        {step === 1 && onBack && (
          <Button fullWidth onClick={onBack} sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
        )}
      </Box>

    </Box>
  )
}

export default PlanWizard
