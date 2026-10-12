import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Typography, Button, IconButton, LinearProgress, useMediaQuery,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import Close from '@mui/icons-material/Close'
import VolumeUp from '@mui/icons-material/VolumeUpOutlined'
import VolumeOff from '@mui/icons-material/VolumeOffOutlined'
import SkipNext from '@mui/icons-material/SkipNext'
import SkipPrevious from '@mui/icons-material/SkipPrevious'
import ListAlt from '@mui/icons-material/ListAlt'
import Check from '@mui/icons-material/Check'
import { motion, AnimatePresence } from 'framer-motion'
import { useBlocker } from 'react-router-dom'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { useAppCtx } from '../../../lib/context'
import { formatClock } from '../dates'
import { ANCHOR_LABELS, blockHeading, listDoses } from '../content'
import { blockProgress, buildSequence, lastAnchorBefore, nextWorkStep, upcomingWork } from './sequence'
import { pauseContext, pauseTitle, sideLabel, stepPosition } from './labels'
import BandButton from './BandButton'
import BandPicker from './BandPicker'
import BlockProgressBar from './BlockProgressBar'
import ExercisePhoto from './ExercisePhoto'
import MainButton from './MainButton'
import PlanSheet from './PlanSheet'
import RecapTile from './RecapTile'
import RestPreview from './RestPreview'
import RoleChips from './RoleChips'
import UpNextCard from './UpNextCard'

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

// Bouton icône du player : cible tactile de 44 px au moins.
const TOUCH = 44
// Hauteur des boutons principaux, portrait et paysage.
const MAIN_H = 68
const MAIN_H_LANDSCAPE = 60

const PORTRAIT_MAX_W = 520
const LONG_NAME = 22

const secondarySx = {
  flex: 1, minWidth: 0, minHeight: TOUCH, px: 1, borderRadius: `${TOUCH / 2}px`, textTransform: 'none',
  fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', color: 'text.primary', borderColor: 'divider',
}

/**
 * Player Renfo plein écran. `beeps` est créé dans le geste utilisateur du bouton
 * « Démarrer » (contrainte iOS) ; le player le libère à sa fermeture.
 * `onValidate(bandsUsed)` ferme le player et ouvre le dialog de ressenti, avec la
 * bande jouée pour chaque exercice à élastique ({ slug: kg }).
 *
 * Rendu dans un portail sur document.body, header applicatif masqué le temps de
 * la séance (son bouton retour captait le tap sur iOS). Fonctionne hors ligne.
 */
const RenfoPlayer = ({ content, kindLabel, weekLabel, bands, initialBandsUsed, beeps, onClose, onValidate }) => {
  const { setOverlay } = useAppCtx()
  const landscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)')
  const shortScreen = useMediaQuery('(max-height: 739.98px)')
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
  const [realSec, setRealSec] = useState(0)
  // Temps écoulé depuis le début de la séance, affiché dans l'en-tête.
  const [elapsedSec, setElapsedSec] = useState(0)
  const [planOpen, setPlanOpen] = useState(false)
  const [bandsUsed, setBandsUsed] = useState(() => ({ ...(initialBandsUsed ?? {}) }))
  const [picker, setPicker] = useState(null) // slug dont on choisit la bande
  const [soundOn, setSoundOn] = useState(readSound)

  const anchor = useRef({ start: 0, pausedAccum: 0, pausedAt: 0 })
  const startedAtRef = useRef(0)
  const wakeRef = useRef(null)
  const beepedRef = useRef(false)

  useEffect(() => { startedAtRef.current = Date.now() }, [])

  useEffect(() => {
    if (finished) return undefined
    const id = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000)
    return () => clearInterval(id)
  }, [finished])

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
  }, [steps])

  // Changer de step relance le décompte : une pause en cours est levée.
  const goNext = useCallback(() => {
    setPaused(false)
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
    setPaused(false)
    if (cursor > 0) {
      primeStep(cursor - 1)
      setCursor(cursor - 1)
    }
  }, [finished, cursor, primeStep])

  // Recommence le step courant ; une pause en cours est conservée.
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

  const shell = {
    position: 'fixed', inset: 0, zIndex: PLAYER_Z,
    bgcolor: 'background.default',
    display: 'flex', flexDirection: 'column',
    pt: 'max(12px, env(safe-area-inset-top, 0px))',
    pb: landscape ? 'max(12px, env(safe-area-inset-bottom, 0px))' : 'max(16px, env(safe-area-inset-bottom, 0px))',
    pl: 'max(16px, env(safe-area-inset-left, 0px))',
    pr: 'max(16px, env(safe-area-inset-right, 0px))',
  }

  if (finished) {
    return createPortal(
      <Box sx={{ ...shell, overflowY: 'auto' }}>
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

  // ── Données du step courant ────────────────────────────────────────────────
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const next = isPause ? nextWorkStep(steps, cursor) : null
  // Exercice courant pour la progression et le plan : le prochain pendant une pause.
  const focusStep = isWork ? step : next
  const segments = blockProgress(steps, cursor)
  const headingIndex = focusStep?.blockIndex ?? segments[0]?.blockIndex ?? 0
  const heading = blocks[headingIndex] ? blockHeading(blocks[headingIndex], headingIndex, blocks) : ''

  const prevWork = isPause ? [...steps.slice(0, cursor)].reverse().find((s) => s.kind === 'work') : null
  const lastAnchor = lastAnchorBefore(steps, cursor)
  const nextUsesBar = next?.anchor && next.exercise?.equipment.includes('bar')
  const moveBarTo = nextUsesBar && next.anchor !== lastAnchor ? next.anchor : null

  const usesBand = isWork && step.exercise?.equipment.includes('band')
  const stepBand = usesBand ? bandFor(step.slug, step.band_kg) : null
  const usesBar = isWork && step.anchor && step.exercise?.equipment.includes('bar')
  const upcoming = isWork ? upcomingWork(steps, cursor, landscape || shortScreen ? 1 : 2) : []

  const elapsedFraction = Math.max(0, Math.min(1, 1 - fraction))
  const plan = () => setPlanOpen(true)

  // ── Briques communes ───────────────────────────────────────────────────────
  const photo = (
    <ExercisePhoto
      key={(isWork ? step : next)?.slug ?? 'none'}
      slug={(isWork ? step : next)?.slug}
      paused={paused}
      sx={landscape ? { height: '100%' } : { height: 'clamp(180px, 32vh, 280px)' }}
    />
  )

  const contextRow = isWork && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 28 }}>
      <Typography sx={{ flex: 1, fontSize: '0.9rem', fontWeight: 800, color: 'primary.main' }}>
        {stepPosition(step) ?? step.blockLabel}
      </Typography>
      {step.side && (
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'text.secondary' }}>{sideLabel(step.side)}</Typography>
      )}
      {step.roles && <RoleChips roles={step.roles} current={step.role} />}
    </Box>
  )

  // Bande (modifiable) et hauteur de barre, à côté du nom.
  const equipment = isWork && (stepBand != null || usesBar) && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {stepBand != null && (
        <BandButton kg={stepBand} bands={bands} onClick={() => setPicker(step.slug)} chipSx={{ height: 30, minWidth: 60, fontSize: '0.85rem' }} />
      )}
      {usesBar && (
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>{ANCHOR_LABELS[step.anchor]}</Typography>
      )}
    </Box>
  )

  // Nom en gros, réduit au-delà de LONG_NAME caractères pour tenir sur deux lignes.
  const longName = (step?.exercise?.name ?? '').length > LONG_NAME
  const name = isWork && (
    <Typography sx={{ fontSize: landscape ? (longName ? '1.2rem' : '1.4rem') : (longName ? '1.5rem' : '1.875rem'), fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', minWidth: 0 }}>
      {step.exercise?.name ?? step.slug}
    </Typography>
  )

  // Nom et dosage : répétitions à droite du nom, ou décompte sous le nom.
  const dose = isWork && (isManual ? (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {name}
        {equipment}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexShrink: 0 }}>
        <Typography sx={{ fontSize: landscape ? '3rem' : '4rem', fontWeight: 800, lineHeight: 0.9, color: 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
          {step.reps}
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: 'text.secondary' }}>reps</Typography>
      </Box>
    </Box>
  ) : (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>{name}</Box>
        {equipment}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
        <Typography sx={{ fontSize: landscape ? '3.25rem' : '4.5rem', fontWeight: 800, lineHeight: 1, color: paused ? 'text.disabled' : 'primary.main', fontVariantNumeric: 'tabular-nums' }}>
          {formatClock(remainingSec)}
        </Typography>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.secondary' }}>
          {paused ? 'en pause · ' : ''}sur {formatClock(step.duration_sec)}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate" value={elapsedFraction * 100}
        sx={{ mt: 0.75, height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: 'primary.main', borderRadius: 3, transition: 'none' } }}
      />
    </Box>
  ))

  // À suivre : cartes compactes, sans surtitre en portrait pour tenir sans défiler.
  const upNext = upcoming.length > 0 && (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {upcoming.map(({ step: s, rest: r }) => (
        <UpNextCard
          key={s.index}
          step={s}
          rest={r}
          title={landscape ? 'Ensuite' : null}
          bandKg={s.exercise?.equipment.includes('band') ? bandFor(s.slug, s.band_kg) : null}
          bands={bands}
          onBandClick={() => setPicker(s.slug)}
        />
      ))}
    </Box>
  )

  // Pause (repos, transition, préparation) : titre, décompte, réglage, suivant.
  const pausePanel = isPause && (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: landscape ? 1 : 1.5, minHeight: 0 }}>
      <Box>
        <Typography sx={{ fontSize: landscape ? '1.2rem' : '1.5rem', fontWeight: 800, lineHeight: 1.15 }}>{pauseTitle(step)}</Typography>
        <Typography variant="body2" color="text.secondary">{pauseContext(step)}</Typography>
      </Box>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ flex: 1, fontSize: landscape ? '3.25rem' : '4.5rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {formatClock(remainingSec)}
          </Typography>
          {step.kind === 'rest' && (
            <>
              <Button variant="outlined" onClick={() => shiftRest(-REST_STEP_SEC)} sx={{ ...secondarySx, flex: 'none', minWidth: 64 }}>-15 s</Button>
              <Button variant="outlined" onClick={() => shiftRest(REST_STEP_SEC)} sx={{ ...secondarySx, flex: 'none', minWidth: 64 }}>+15 s</Button>
            </>
          )}
        </Box>
        <LinearProgress
          variant="determinate" value={elapsedFraction * 100}
          sx={{ mt: 0.75, height: 6, borderRadius: 3, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: 'text.secondary', borderRadius: 3, transition: 'none' } }}
        />
      </Box>
      <RestPreview
        next={next}
        newExercise={next && next.slug !== prevWork?.slug}
        bandKg={next?.exercise?.equipment.includes('band') ? bandFor(next.slug, next.band_kg) : null}
        bands={bands}
        moveBarTo={moveBarTo}
        onBandClick={() => next && setPicker(next.slug)}
        photo={!landscape}
        paused={paused}
      />
    </Box>
  )

  // Bouton principal selon le step.
  const mainAction = isManual
    ? { label: 'Série faite', tone: 'primary', onClick: goNext }
    : isWork
      ? { label: paused ? 'Reprendre' : 'Pause', tone: 'outlined', onClick: togglePause }
      : { label: 'Passer le repos', tone: 'neutral', onClick: goNext }

  // Commandes secondaires (portrait).
  const secondary = isWork ? (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" onClick={goPrev} disabled={cursor === 0} sx={secondarySx}>Précédent</Button>
      {isManual
        ? usesBand && <Button variant="outlined" onClick={() => setPicker(step.slug)} sx={secondarySx}>Bande</Button>
        : <Button variant="outlined" onClick={resetStep} sx={secondarySx}>Recommencer</Button>}
      <Button variant="outlined" onClick={goNext} sx={secondarySx}>Passer</Button>
    </Box>
  ) : step.kind === 'rest' && (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" onClick={goPrev} startIcon={<SkipPrevious />} sx={secondarySx}>Précédent</Button>
    </Box>
  )

  const soundButton = (
    <IconButton onClick={toggleSound} sx={{ width: TOUCH, height: TOUCH, color: soundOn ? 'primary.main' : 'text.disabled' }} aria-label={soundOn ? 'Couper le son' : 'Activer le son'}>
      {soundOn ? <VolumeUp /> : <VolumeOff />}
    </IconButton>
  )
  const closeButton = (
    <IconButton onClick={() => setConfirmQuit(true)} sx={{ width: TOUCH, height: TOUCH, color: 'text.secondary' }} aria-label="Quitter la séance">
      <Close />
    </IconButton>
  )

  const animated = (children, sx) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={cursor}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ display: 'flex', flexDirection: 'column', minHeight: 0, ...sx }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )

  const body = landscape ? (
    // ── Paysage : photo à gauche, tout le reste à droite, sans défilement ────
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 2 }}>
      <Box sx={{ width: '46%', minHeight: 0, display: 'flex' }}>{photo}</Box>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <BlockProgressBar segments={segments} heading={heading} onOpenPlan={plan} compact />
          </Box>
          <IconButton onClick={plan} sx={{ width: TOUCH, height: TOUCH, color: 'primary.main' }} aria-label="Voir le plan de la séance">
            <ListAlt />
          </IconButton>
          {closeButton}
        </Box>
        {animated(
          isWork ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, minHeight: 0, overflow: 'hidden' }}>
              {contextRow}
              {dose}
              {upNext}
            </Box>
          ) : pausePanel,
          { flex: 1, overflow: 'hidden' },
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
          <IconButton onClick={goPrev} disabled={cursor === 0} aria-label="Précédent" sx={{ width: MAIN_H_LANDSCAPE, height: MAIN_H_LANDSCAPE, border: '1px solid', borderColor: 'divider', color: 'text.primary' }}>
            <SkipPrevious />
          </IconButton>
          <MainButton {...mainAction} height={MAIN_H_LANDSCAPE} />
          <IconButton onClick={goNext} aria-label="Passer" sx={{ width: MAIN_H_LANDSCAPE, height: MAIN_H_LANDSCAPE, border: '1px solid', borderColor: 'divider', color: 'text.primary' }}>
            <SkipNext />
          </IconButton>
        </Box>
      </Box>
    </Box>
  ) : (
    // ── Portrait ──────────────────────────────────────────────────────────────
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', maxWidth: PORTRAIT_MAX_W, mx: 'auto', width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        {closeButton}
        <Typography noWrap sx={{ flex: 1, textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {[kindLabel, formatClock(elapsedSec)].filter(Boolean).join(' · ')}
        </Typography>
        {soundButton}
      </Box>
      <Box sx={{ flexShrink: 0 }}>
        <BlockProgressBar segments={segments} heading={heading} onOpenPlan={plan} />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pt: 1 }}>
        {animated(
          isWork ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {photo}
              {contextRow}
              {dose}
              {upNext}
            </Box>
          ) : pausePanel,
        )}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 1.25, flexShrink: 0 }}>
        {secondary}
        <MainButton {...mainAction} height={MAIN_H} />
      </Box>
    </Box>
  )

  return createPortal(
    <Box sx={shell}>
      {body}

      <PlanSheet
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        zIndex={DIALOG_Z}
        content={content}
        steps={steps}
        cursor={cursor}
        finished={finished}
        current={focusStep}
        bandFor={bandFor}
        bands={bands}
        kindLabel={kindLabel}
        weekLabel={weekLabel}
        totalSeconds={totalSeconds}
      />

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
