import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, Button, IconButton, CircularProgress, Alert, Link } from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBackRounded'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { glassSx } from '../../../styles/glass'
import { generatePlan } from '../../../lib/training'
import { parsePaceInput } from '../constants'
import { resolveDistanceM, resolveStartDate, todayISODate } from './draft'
import StepRace from './steps/StepRace'
import StepFitness from './steps/StepFitness'
import StepGoal from './steps/StepGoal'
import StepReview from './steps/StepReview'

const STEPS = [
  { label: 'Course', Component: StepRace },
  { label: 'Forme', Component: StepFitness },
  { label: 'Objectif', Component: StepGoal },
  { label: 'Récapitulatif', Component: StepReview },
]

// Inset de la barre basse (coins concentriques : 34 = 10 + 24).
const WIZARD_INSET = 10

const emptyDraft = {
  // Étape 1 — course
  name: '',
  date: '',
  distancePreset: null,   // 5000 | 10000 | 21097 | 42195 | 'custom'
  distanceCustomM: '',
  elevationM: '',
  startChoice: 'today',   // 'today' | 'monday' | 'custom'
  startCustom: '',        // ISO yyyy-MM-dd si 'custom'
  // Étape 2 — forme
  source: 'coros',        // 'coros' | 'manual'
  corosLoaded: false,
  vmaKmh: '',
  thresholdPace: '',      // "m:ss"
  vo2max: '',
  predictions: null,
  runningLevel: '',
  // Étape 3 — objectif
  goalSec: null,          // durée cible en secondes (sélecteur à roues)
  previousRaces: [],      // [{ name, time }]
  notes: '',
}

// ── Validité par étape (contrôle le bouton Suivant) ──────────────────────────
const stepValid = (step, d) => {
  if (step === 0) {
    const today = todayISODate()
    const future = Boolean(d.date) && d.date > today
    const start = resolveStartDate(d)
    const startOk = start >= today && (!d.date || start <= d.date)
    return Boolean(d.name.trim()) && future && resolveDistanceM(d) > 0 && startOk
  }
  if (step === 1) {
    const vma = Number(d.vmaKmh)
    return !Number.isNaN(vma) && vma >= 10 && vma <= 25
  }
  return true
}

const buildPayload = (d) => ({
  start_date: resolveStartDate(d),
  race: {
    name: d.name.trim(),
    date: d.date,
    distance_m: resolveDistanceM(d),
    elevation_m: Number(d.elevationM) > 0 ? Number(d.elevationM) : undefined,
  },
  goal_time_sec: d.goalSec != null && d.goalSec > 0 ? d.goalSec : undefined,
  fitness_snapshot: {
    source: d.source,
    vma_kmh: Number(d.vmaKmh),
    threshold_pace_sec: parsePaceInput(d.thresholdPace) ?? undefined,
    vo2max: Number(d.vo2max) > 0 ? Number(d.vo2max) : undefined,
    predictions: d.source === 'coros' && d.predictions ? d.predictions : undefined,
  },
  previous_races: d.previousRaces.filter((r) => r.name.trim()).length
    ? d.previousRaces.filter((r) => r.name.trim())
    : undefined,
  notes: d.notes.trim() || undefined,
})

const PlanWizard = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(emptyDraft)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [conflictPlanId, setConflictPlanId] = useState(null)

  const patch = (updates) => setDraft((d) => ({ ...d, ...updates }))
  const { Component } = STEPS[step]
  const isLast = step === STEPS.length - 1
  const canNext = stepValid(step, draft)

  const goNext = () => { if (canNext) setStep((s) => Math.min(s + 1, STEPS.length - 1)) }
  const goPrev = () => setStep((s) => Math.max(s - 1, 0))

  const handleGenerate = async () => {
    setGenerating(true)
    setError(null)
    setConflictPlanId(null)
    try {
      const { plan_id } = await generatePlan(buildPayload(draft))
      navigate(`/training/plan/${plan_id}`, { replace: true })
    } catch (e) {
      if (e.status === 409) {
        setConflictPlanId(e.body?.plan_id ?? null)
        setError('Un plan actif existe déjà. Archive-le ou supprime-le avant d’en créer un nouveau.')
      } else {
        setError(e.message)
      }
      setGenerating(false)
    }
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: 12 }}>

        {/* Progression */}
        <Box sx={{ mt: 2, mb: 2.5 }}>
          <Box sx={{ display: 'flex', gap: 0.75, mb: 1 }}>
            {STEPS.map((s, i) => (
              <Box
                key={s.label}
                sx={{
                  flex: 1, height: 4, borderRadius: 2, transition: 'background .2s',
                  bgcolor: i <= step ? 'primary.main' : 'divider',
                }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Étape {step + 1} / {STEPS.length} · {STEPS[step].label}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
            {conflictPlanId && (
              <Box sx={{ mt: 0.5 }}>
                <Link component="button" type="button" onClick={() => navigate(`/training/plan/${conflictPlanId}`)}>
                  Ouvrir le plan actif
                </Link>
              </Box>
            )}
          </Alert>
        )}

        <Component draft={draft} patch={patch} goTo={setStep} />

      </Box>

      {/* Barre basse — pattern Côtes : pill primaire pleine largeur + bouton rond retour.
          Coins concentriques : radius carte = INSET (10) + radius bouton (24) = 34. */}
      <Box sx={{
        position: 'fixed', zIndex: 1200,
        left: '4vw', right: '4vw', maxWidth: 620, mx: 'auto',
        bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
        borderRadius: '34px', overflow: 'hidden', ...glassSx,
      }}>
        <Box sx={{ p: `${WIZARD_INSET}px`, display: 'flex', gap: 1 }}>
          {step > 0 && (
            <IconButton
              onClick={goPrev}
              disabled={generating}
              aria-label="Étape précédente"
              sx={{
                width: 48, height: 48, flexShrink: 0, borderRadius: '24px',
                border: '1px solid', borderColor: 'divider', color: 'text.secondary',
              }}
            >
              <ArrowBack sx={{ fontSize: 20 }} />
            </IconButton>
          )}
          <Button
            fullWidth
            variant="contained"
            onClick={isLast ? handleGenerate : goNext}
            disabled={!canNext || generating}
            sx={{ height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 600, fontSize: '0.95rem', boxShadow: 'none' }}
          >
            {generating
              ? <CircularProgress size={18} color="inherit" />
              : isLast ? 'Générer mon plan' : 'Continuer'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default PlanWizard
