import { useState } from 'react'
import { Box, Typography, Button, LinearProgress } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import Step1Course from './Step1Course'
import Step2Fitness from './Step2Fitness'
import Step3Objectif from './Step3Objectif'
import Step4Previous from './Step4Previous'
import Step5Summary from './Step5Summary'

const STEPS = [
  { label: 'La course',             skippable: false, Component: Step1Course  },
  { label: 'Forme / VMA',           skippable: false, Component: Step2Fitness  },
  { label: 'Objectif',              skippable: false, Component: Step3Objectif },
  { label: 'Éditions précédentes',  skippable: true,  Component: Step4Previous },
  { label: 'Récapitulatif',         skippable: false, Component: Step5Summary  },
]

const INITIAL_CONTEXT = {
  raceName: '',
  raceType: null,        // '10km' | 'semi' | 'marathon' | 'trail'
  raceDate: '',
  trailDistance: '',
  trailElevation: '',
  vmaSource: 'coros',   // 'coros' | 'manual' | 'test'
  vmaManual: '',
  targetPalier: null,   // 'realistic' | 'ambitious' | 'very_ambitious'
  targetTime: '',
  previousRaces: [],
  notes: '',
}

const PlanWizard = ({ onGenerate }) => {
  const [step, setStep] = useState(1)
  const [planContext, setPlanContext] = useState(INITIAL_CONTEXT)

  const updateContext = (partial) => setPlanContext(prev => ({ ...prev, ...partial }))

  const handleNext = () => {
    if (step === STEPS.length) onGenerate(planContext)
    else setStep(s => s + 1)
  }
  const handleBack = () => setStep(s => s - 1)
  const handleSkip = () => setStep(s => s + 1)

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
        <Component planContext={planContext} updateContext={updateContext} />
      </Box>

      {/* Navigation */}
      <Box sx={{ px: 2, pt: 1, pb: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button variant="contained" fullWidth disableElevation onClick={handleNext}>
          {step === STEPS.length ? 'Générer mon plan' : 'Continuer'}
        </Button>
        {skippable && (
          <Button fullWidth onClick={handleSkip} sx={{ color: 'text.secondary' }}>
            Passer cette étape
          </Button>
        )}
        {step > 1 && (
          <Button fullWidth onClick={handleBack} sx={{ color: 'text.secondary' }}>
            Retour
          </Button>
        )}
      </Box>

    </Box>
  )
}

export default PlanWizard
