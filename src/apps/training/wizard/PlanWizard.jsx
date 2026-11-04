import { useId, useState } from 'react'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { texteErreur } from '../../../lib/reseau'
import { Box, Typography, Alert, Link } from '@mui/material'
import BarreAttente from '../../../ui/BarreAttente'
import BarreBas from '../../../ui/BarreBas'
import Bouton from '../../../ui/Bouton'
import GardeChangements from '../../../ui/GardeChangements'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { space } from '../../../styles/tokens'
import { generatePlan } from '../../../lib/training'
import { parsePaceInput } from '../constants'
import { emptyDraft, resolveDistanceM, resolveStartDate, stepRaison } from './draft'
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
  const navigate = useAppNavigate()
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(emptyDraft)
  const [generating, setGenerating] = useState(false)
  const attenteGeneration = useFinAttente(generating)
  const raisonId = useId()
  const [error, setError] = useState(null)
  const [conflictPlanId, setConflictPlanId] = useState(null)

  const patch = (updates) => setDraft((d) => ({ ...d, ...updates }))
  const { Component } = STEPS[step]
  const isLast = step === STEPS.length - 1
  const raison = stepRaison(step, draft)
  const canNext = raison === null
  // Garde : une réponse donnée ou une étape passée. Aucun effet des étapes ne modifie
  // le brouillon, la comparaison au brouillon vide suffit.
  const aDesReponses = step > 0 || JSON.stringify(draft) !== JSON.stringify(emptyDraft)

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
        setError(texteErreur(e, 'La génération n\'a pas pu démarrer. Réessaie.'))
      }
      setGenerating(false)
    }
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: '1 0 auto', width: '100%', maxWidth: 640, mx: 'auto', px: 2, pb: space[24] }}>

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

      <BarreBas phrase={attenteGeneration.visible ? null : raison} phraseId={raisonId}>
        {attenteGeneration.visible
          ? (
            <BarreAttente
              place="barre"
              phrase="Génération de ton plan"
              duree={DUREES.actionCourte}
              {...attenteGeneration}
              sx={{ flex: 1, minWidth: 0 }}
            />
          )
          : (
            <>
              {step > 0 && (
                <Bouton variante="chip" onClick={goPrev} sx={{ flex: 1, minWidth: 0 }}>
                  Retour
                </Bouton>
              )}
              <Bouton
                variante="ink"
                onClick={isLast ? handleGenerate : goNext}
                disabled={!canNext}
                raisonDansBarre
                aria-describedby={canNext ? undefined : raisonId}
                sx={{ flex: 2, minWidth: 0 }}
              >
                {isLast ? 'Générer mon plan' : 'Continuer'}
              </Bouton>
            </>
          )}
      </BarreBas>

      <GardeChangements
        actif={aDesReponses && !generating}
        titre="Tes réponses ne seront pas gardées."
        action="Quitter l'assistant"
      />
    </Box>
  )
}

export default PlanWizard
