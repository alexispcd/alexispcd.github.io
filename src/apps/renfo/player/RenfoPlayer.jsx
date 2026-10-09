import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Typography, Button, IconButton, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import Close from '@mui/icons-material/Close'
import VolumeUp from '@mui/icons-material/VolumeUpOutlined'
import VolumeOff from '@mui/icons-material/VolumeOffOutlined'
import Pause from '@mui/icons-material/Pause'
import PlayArrow from '@mui/icons-material/PlayArrow'
import SkipNext from '@mui/icons-material/SkipNext'
import SkipPrevious from '@mui/icons-material/SkipPrevious'
import RestartAlt from '@mui/icons-material/RestartAlt'
import Check from '@mui/icons-material/Check'
import { motion, AnimatePresence } from 'framer-motion'
import { useBlocker } from 'react-router-dom'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { useAppCtx } from '../../../lib/context'
import { formatClock } from '../dates'
import { ANCHOR_LABELS, listDoses } from '../content'
import BandChip from '../BandChip'
import ExerciseThumb from '../session/ExerciseThumb'
import { buildSequence, lastAnchorBefore, nextWorkStep } from './sequence'
import ProgressRing from './ProgressRing'
import RecapTile from './RecapTile'
import RestPreview from './RestPreview'
import BandPicker from './BandPicker'

const SOUND_KEY = 'renfo:player_sound'

// La coque du player est un overlay plein écran. Tout élément flottant se rendant
// dans son propre portail (Dialog MUI, zIndex 1300) doit repasser au-dessus.
const PLAYER_Z = 2000
const DIALOG_Z = PLAYER_Z + 100

// Avance du bip sur la fin réelle du step : le son doit tomber avant la bascule.
const BEEP_LEAD_SEC = 1
const TICK_MS = 100
// Pas des boutons de réglage d'un repos.
const REST_STEP_SEC = 15

const readSound = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

const writeSound = (on) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Stockage indisponible : le réglage vaut pour cette séance.
  }
}

/** "Superset 1 · Tour 2/4 · A", "Bloc principal · Série 2/3", "Échauffement". */
const stepContext = (step) => {
  const parts = [step.blockLabel]
  if (step.round) parts.push(`Tour ${step.round}/${step.roundCount}`)
  if (step.set) parts.push(`Série ${step.set}/${step.setCount}`)
  if (step.role) parts.push(step.role)
  return parts.filter(Boolean).join(' · ')
}

const restTitle = (step) => (step.kind === 'prep' ? 'Préparation' : step.restType === 'transition' ? 'Transition' : 'Récupération')

/**
 * Player Renfo plein écran. `beeps` est créé dans le geste utilisateur du bouton
 * « Démarrer » (contrainte iOS) ; le player le libère à sa fermeture.
 * `onValidate(bandsUsed)` ferme le player et ouvre le dialog de ressenti, avec la
 * bande jouée pour chaque exercice à élastique ({ slug: kg }).
 *
 * Rendu dans un portail sur document.body, header applicatif masqué le temps de
 * la séance (son bouton retour captait le tap sur iOS). Fonctionne hors ligne.
 */
const RenfoPlayer = ({ content, bands, initialBandsUsed, beeps, onClose, onValidate }) => {
  const theme = useTheme()
  const accent = theme.palette.primary.main
  const { setOverlay } = useAppCtx()
  const { steps, totalSeconds } = useMemo(() => buildSequence(content), [content])
  const exerciseCount = useMemo(() => listDoses(content).filter(({ block }) => block.type !== 'cooldown' && block.type !== 'warmup').length, [content])

  const [cursor, setCursor] = useState(0)
  const [finished, setFinished] = useState(steps.length === 0)
  const [paused, setPaused] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  // Décompte du step auto courant, alimenté par la boucle de tick.
  const [display, setDisplay] = useState(() => ({ remainingSec: steps[0]?.duration_sec ?? 0, fraction: 1 }))
  // Décalage de la fin du repos courant (boutons -15 s / +15 s).
  const [restShift, setRestShift] = useState(0)
  // Vignette affichée sur un step de travail : 0 départ, 1 arrivée.
  const [frame, setFrame] = useState(0)
  const [realSec, setRealSec] = useState(0)
  const [bandsUsed, setBandsUsed] = useState(() => ({ ...(initialBandsUsed ?? {}) }))
  const [picker, setPicker] = useState(null) // slug dont on choisit la bande
  const [soundOn, setSoundOn] = useState(readSound)

  const anchor = useRef({ start: 0, pausedAccum: 0, pausedAt: 0 })
  const startedAtRef = useRef(0)
  const wakeRef = useRef(null)
  const beepedRef = useRef(false)

  useEffect(() => { startedAtRef.current = Date.now() }, [])

  useEffect(() => {
    setOverlay(true)
    return () => setOverlay(false)
  }, [setOverlay])

  const step = steps[cursor]
  const isAuto = step?.advance === 'auto'
  const isManual = step?.advance === 'manual'
  const isWork = step?.kind === 'work'
  const isPause = step?.kind === 'rest' || step?.kind === 'prep'
  const duration = (step?.duration_sec ?? 0) + (isPause ? restShift : 0)

  const bandFor = useCallback((slug, planned) => bandsUsed[slug] ?? planned ?? null, [bandsUsed])

  // ── Geste retour : intercepté, il demande confirmation ─────────────────────
  const blocker = useBlocker(!finished)
  const blocked = blocker.state === 'blocked'
  const confirmOpen = confirmQuit || blocked

  const stay = useCallback(() => {
    setConfirmQuit(false)
    if (blocked) blocker.reset()
  }, [blocked, blocker])

  const quit = useCallback(() => {
    setConfirmQuit(false)
    if (blocked) blocker.proceed()
    onClose()
  }, [blocked, blocker, onClose])

  // ── Wake Lock : écran maintenu allumé ──────────────────────────────────────
  const acquireWake = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try { wakeRef.current = await navigator.wakeLock.request('screen') } catch { /* silencieux */ }
  }, [])

  useEffect(() => {
    acquireWake()
    const onVis = () => {
      if (document.visibilityState === 'visible' && !finished) acquireWake()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      wakeRef.current?.release?.().catch(() => {})
      wakeRef.current = null
    }
  }, [acquireWake, finished])

  useEffect(() => () => { beeps?.dispose?.() }, [beeps])

  // ── Temps écoulé dans le step courant (ms), pauses déduites ─────────────────
  const stepElapsedMs = useCallback(() => {
    const a = anchor.current
    const live = a.pausedAt ? Date.now() - a.pausedAt : 0
    return Date.now() - a.start - a.pausedAccum - live
  }, [])

  const reanchor = useCallback(() => {
    anchor.current = { start: Date.now(), pausedAccum: 0, pausedAt: paused ? Date.now() : 0 }
    beepedRef.current = false
  }, [paused])

  useEffect(() => {
    reanchor()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- l'ancre ne se repose qu'au changement de step
  }, [cursor])

  // Prépare l'affichage du step d'index `idx` (décompte plein, réglages remis à zéro).
  const primeStep = useCallback((idx) => {
    setDisplay({ remainingSec: steps[idx]?.duration_sec ?? 0, fraction: 1 })
    setRestShift(0)
    setFrame(0)
  }, [steps])

  const goNext = useCallback(() => {
    if (cursor >= steps.length - 1) {
      setRealSec(Math.round((Date.now() - startedAtRef.current) / 1000))
      setFinished(true)
    } else {
      primeStep(cursor + 1)
      setCursor(cursor + 1)
    }
  }, [cursor, steps.length, primeStep])

  const goPrev = useCallback(() => {
    if (finished) { setFinished(false); return }
    if (cursor > 0) {
      primeStep(cursor - 1)
      setCursor(cursor - 1)
    }
  }, [finished, cursor, primeStep])

  const resetStep = useCallback(() => {
    reanchor()
    primeStep(cursor)
  }, [reanchor, primeStep, cursor])

  // Décale la fin du repos courant. Le bip est réarmé si la fin s'éloigne.
  const shiftRest = (delta) => {
    const elapsed = stepElapsedMs() / 1000
    const next = Math.max(restShift + delta, Math.ceil(elapsed) - (step?.duration_sec ?? 0))
    if (delta > 0) beepedRef.current = false
    setRestShift(next)
  }

  // ── Boucle de tick des steps auto ──────────────────────────────────────────
  useEffect(() => {
    if (finished || !isAuto || paused) return undefined
    const id = setInterval(() => {
      const elapsed = stepElapsedMs() / 1000
      const remaining = duration - elapsed
      if (remaining <= BEEP_LEAD_SEC && !beepedRef.current) {
        beepedRef.current = true
        if (soundOn) beeps?.play?.(step.kind === 'work' ? 'double' : 'single')
      }
      if (remaining <= 0) {
        goNext()
      } else {
        setDisplay({
          remainingSec: Math.max(0, Math.ceil(remaining)),
          fraction: Math.max(0, Math.min(1, 1 - elapsed / duration)),
        })
      }
    }, TICK_MS)
    return () => clearInterval(id)
  }, [finished, isAuto, paused, step, duration, stepElapsedMs, soundOn, beeps, goNext])

  const togglePause = () => {
    const a = anchor.current
    if (!paused) {
      a.pausedAt = Date.now()
    } else if (a.pausedAt) {
      a.pausedAccum += Date.now() - a.pausedAt
      a.pausedAt = 0
    }
    setPaused((p) => !p)
  }

  const toggleSound = () => {
    writeSound(!soundOn)
    setSoundOn(!soundOn)
  }

  // Bandes jouées : la bande choisie ou prévue de chaque exercice à élastique.
  const finalBands = () => {
    const out = {}
    for (const { dose } of listDoses(content)) {
      const kg = bandFor(dose.slug, dose.band_kg)
      if (kg != null && EXERCISE_INDEX[dose.slug]?.equipment.includes('band')) out[dose.slug] = Number(kg)
    }
    return out
  }

  const pickBand = (kg) => {
    setBandsUsed((b) => ({ ...b, [picker]: Number(kg) }))
    setPicker(null)
  }

  const { remainingSec, fraction } = display
  const progress = steps.length ? Math.round((cursor / steps.length) * 100) : 100

  const shell = {
    position: 'fixed', inset: 0, zIndex: PLAYER_Z,
    bgcolor: 'background.default',
    display: 'flex', flexDirection: 'column',
    pt: 'max(12px, env(safe-area-inset-top, 0px))',
    pb: 'calc(max(16px, env(safe-area-inset-bottom, 0px)) + 24px)',
    pl: 'max(16px, env(safe-area-inset-left, 0px))',
    pr: 'max(16px, env(safe-area-inset-right, 0px))',
  }

  if (finished) {
    return createPortal(
      <Box sx={shell}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: 460, mx: 'auto', width: '100%', textAlign: 'center', px: 1 }}>
          <Box sx={{ width: 72, height: 72, borderRadius: '50%', mb: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', color: 'primary.main' }}>
            <Check sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Séance terminée</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Beau travail. Enregistre ton ressenti pour suivre ta progression.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 3.5, width: '100%' }}>
            <RecapTile value={formatClock(realSec)} label="temps réel" />
            <RecapTile value={formatClock(totalSeconds)} label="estimé" />
            <RecapTile value={String(exerciseCount)} label={exerciseCount > 1 ? 'exercices' : 'exercice'} />
          </Box>
          <Button
            fullWidth variant="contained" onClick={() => onValidate(finalBands())}
            sx={{ mt: 4, height: 52, borderRadius: '26px', textTransform: 'none', fontWeight: 700, fontSize: '1rem', boxShadow: 'none' }}
          >
            Valider la séance
          </Button>
          <Button fullWidth variant="text" onClick={onClose} sx={{ mt: 1, height: 46, borderRadius: '23px', textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}>
            Fermer
          </Button>
        </Box>
      </Box>,
      document.body,
    )
  }

  // ── Aperçu pendant un repos ou la préparation ──────────────────────────────
  const next = isPause ? nextWorkStep(steps, cursor) : null
  const prevWork = isPause ? [...steps.slice(0, cursor)].reverse().find((s) => s.kind === 'work') : null
  const lastAnchor = lastAnchorBefore(steps, cursor)
  const nextUsesBar = next?.anchor && next.exercise?.equipment.includes('bar')
  const moveBarTo = nextUsesBar && next.anchor !== lastAnchor ? next.anchor : null
  const stepBand = isWork ? bandFor(step.slug, step.band_kg) : null
  const partnerName = isWork && step.partner ? EXERCISE_INDEX[step.partner]?.name : null

  return createPortal(
    <Box sx={shell}>
      {/* Barre du haut : fermer, son */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
        <IconButton onClick={() => setConfirmQuit(true)} sx={{ color: 'text.secondary' }} aria-label="Fermer">
          <Close />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={toggleSound} sx={{ color: soundOn ? 'primary.main' : 'text.disabled' }} aria-label="Son">
          {soundOn ? <VolumeUp /> : <VolumeOff />}
        </IconButton>
      </Box>

      <LinearProgress
        variant="determinate" value={progress}
        sx={{ height: 5, borderRadius: 3, flexShrink: 0, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 3 } }}
      />

      {/* Step courant */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460, mx: 'auto', width: '100%', minHeight: 0, overflowY: 'auto' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={cursor}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            <Box sx={{ textAlign: 'center', px: 1, py: 1 }}>
              {isPause ? (
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'text.disabled' }}>
                  {restTitle(step)}
                </Typography>
              ) : (
                <>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'primary.main' }}>
                    {stepContext(step)}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ mt: 0.5, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                    {step.exercise?.name ?? step.slug}
                  </Typography>
                  {step.side && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Côté {step.side}</Typography>
                  )}
                  {partnerName && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      A : {step.role === 'A' ? step.exercise?.name : partnerName} · B : {step.role === 'B' ? step.exercise?.name : partnerName}
                    </Typography>
                  )}
                  {step.round === 1 && step.role === 'A' && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 600, color: 'primary.main' }}>
                      Enchaîne A puis B, repos après B
                    </Typography>
                  )}

                  {/* Vignette (départ, arrivée au toucher), bande, hauteur de barre */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mt: 2 }}>
                    <Box onClick={() => setFrame((f) => 1 - f)} sx={{ cursor: 'pointer' }}>
                      <ExerciseThumb slug={step.slug} frame={frame} size={112} radius={18} />
                    </Box>
                    {(stepBand != null || step.anchor) && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                        {stepBand != null && <BandChip kg={stepBand} bands={bands} onClick={() => setPicker(step.slug)} sx={{ height: 32, minWidth: 64, fontSize: '0.85rem' }} />}
                        {step.anchor && step.exercise?.equipment.includes('bar') && (
                          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            {ANCHOR_LABELS[step.anchor]}
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Box>
                </>
              )}

              {/* Décompte ou répétitions */}
              <Box sx={{ mt: 2.5, mb: 1 }}>
                {isAuto ? (
                  <ProgressRing
                    fraction={fraction}
                    remainingSec={remainingSec}
                    size={isPause ? 200 : 220}
                    sub={paused ? 'en pause' : isPause ? (step.kind === 'prep' ? 'en place' : 'repos') : null}
                    color={isPause ? '#94a3b8' : accent}
                  />
                ) : (
                  <Box sx={{ py: 1 }}>
                    <Typography sx={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1, color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
                      {step?.reps}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mt: 0.5 }}>
                      répétitions
                    </Typography>
                  </Box>
                )}
              </Box>

              {isPause && step.kind === 'rest' && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                  <Button variant="outlined" size="small" onClick={() => shiftRest(-REST_STEP_SEC)} sx={{ borderRadius: '16px', minWidth: 72, fontWeight: 700 }}>
                    -15 s
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => shiftRest(REST_STEP_SEC)} sx={{ borderRadius: '16px', minWidth: 72, fontWeight: 700 }}>
                    +15 s
                  </Button>
                </Box>
              )}

              {isPause && (
                <RestPreview
                  next={next}
                  newExercise={next && next.slug !== prevWork?.slug}
                  bandKg={next ? bandFor(next.slug, next.band_kg) : null}
                  bands={bands}
                  moveBarTo={moveBarTo}
                  onBandClick={() => next && setPicker(next.slug)}
                />
              )}
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Contrôles */}
      <Box sx={{ maxWidth: 460, mx: 'auto', width: '100%', flexShrink: 0, pt: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <IconButton onClick={resetStep} sx={{ width: 40, height: 40, color: 'text.disabled' }} aria-label="Recommencer">
            <RestartAlt sx={{ fontSize: 22 }} />
          </IconButton>
          <IconButton onClick={goPrev} disabled={cursor === 0} sx={{ color: 'text.secondary' }} aria-label="Précédent">
            <SkipPrevious sx={{ fontSize: 32 }} />
          </IconButton>
          {/* Bouton central : valide la série en répétitions, met en pause un décompte. */}
          <IconButton
            onClick={isManual ? goNext : togglePause}
            aria-label={isManual ? 'Série terminée' : (paused ? 'Reprendre' : 'Pause')}
            sx={{
              width: 72, height: 72, border: '2px solid', borderColor: 'primary.main',
              color: isManual ? 'primary.contrastText' : 'primary.main',
              bgcolor: isManual ? 'primary.main' : 'transparent',
              '&:hover': { bgcolor: isManual ? 'primary.main' : 'action.hover' },
            }}
          >
            {isManual ? <Check sx={{ fontSize: 40 }} /> : (paused ? <PlayArrow sx={{ fontSize: 32 }} /> : <Pause sx={{ fontSize: 32 }} />)}
          </IconButton>
          <IconButton onClick={goNext} sx={{ color: 'text.secondary' }} aria-label="Suivant">
            <SkipNext sx={{ fontSize: 32 }} />
          </IconButton>
          <Box sx={{ width: 40, flexShrink: 0 }} />
        </Box>
      </Box>

      <BandPicker
        open={Boolean(picker)}
        exerciseName={picker ? EXERCISE_INDEX[picker]?.name : ''}
        assist={picker ? EXERCISE_INDEX[picker]?.assist : false}
        current={picker ? bandFor(picker, listDoses(content).find(({ dose }) => dose.slug === picker)?.dose.band_kg) : null}
        bands={bands}
        zIndex={DIALOG_Z}
        onClose={() => setPicker(null)}
        onPick={pickBand}
      />

      <Dialog
        open={confirmOpen}
        onClose={stay}
        sx={{ zIndex: DIALOG_Z }}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Quitter la séance ?</DialogTitle>
        <DialogContent>
          <DialogContentText>La progression sera perdue.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={stay} color="inherit">Continuer</Button>
          <Button onClick={quit} variant="contained">Quitter</Button>
        </DialogActions>
      </Dialog>
    </Box>,
    document.body,
  )
}

export default RenfoPlayer
