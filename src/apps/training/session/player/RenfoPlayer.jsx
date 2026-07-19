import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  Box, Typography, Button, IconButton, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
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
import { ZONE_STYLE, cleanText, formatGoalTime } from '../../constants'
import { glassSx, GLASS_BACKDROP } from '../../../../styles/glass'
import { useAppCtx } from '../../../../lib/context'
import { buildSequence } from './sequence'

const ACCENT = ZONE_STYLE.renfo.main
const SOUND_KEY = 'training:player_sound'

// ── Anneau de progression SVG ────────────────────────────────────────────────
const RING = 248
const STROKE = 14
const R = (RING - STROKE) / 2
const CIRC = 2 * Math.PI * R

const ProgressRing = ({ fraction, remainingSec, sub, color }) => (
  <Box sx={{ position: 'relative', width: RING, height: RING, maxWidth: '78vw', maxHeight: '78vw', mx: 'auto' }}>
    <Box component="svg" viewBox={`0 0 ${RING} ${RING}`} sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
      <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(128,128,128,0.18)" strokeWidth={STROKE} />
      <circle
        cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 0.25s linear' }}
      />
    </Box>
    <Box sx={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Typography sx={{ fontSize: '3.4rem', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
        {formatGoalTime(remainingSec)}
      </Typography>
      {sub && (
        <Typography sx={{ mt: 1, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary' }}>
          {sub}
        </Typography>
      )}
    </Box>
  </Box>
)

/** Libellé de l'aperçu "À suivre" pour un step donné. */
const nextLabel = (step) => {
  if (!step) return null
  if (step.kind === 'rest') return 'récupération'
  return `${step.exercise?.name}${step.side ? ` (${step.side})` : ''}`
}

/**
 * Player renfo plein écran. `beeps` est créé dans le geste utilisateur du bouton
 * "Démarrer" (contrainte iOS) et passé ici ; le player le libère à sa fermeture.
 * `onValidate` ferme le player et ouvre le dialog RPE parent.
 *
 * Rendu dans un portail sur `document.body` et header applicatif masqué le temps
 * de la séance : le header est un overlay `position: fixed` en verre dépoli dont
 * le bouton retour se superpose exactement au bouton de fermeture du player, et
 * sur iOS la couche de compositing du backdrop-filter captait le tap.
 */
const RenfoPlayer = ({ blocks, beeps, onClose, onValidate }) => {
  const { setOverlay } = useAppCtx()
  const { steps, totalSeconds } = useMemo(() => buildSequence(blocks), [blocks])
  const exerciseCount = useMemo(
    () => (blocks ?? []).reduce((n, b) => n + (Array.isArray(b?.exercises) ? b.exercises.length : 0), 0),
    [blocks],
  )

  const [cursor, setCursor] = useState(0)
  const [finished, setFinished] = useState(steps.length === 0)
  const [paused, setPaused] = useState(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  // Décompte du step auto courant, alimenté par la boucle de tick (jamais lu
  // depuis un ref pendant le rendu). Initialisé plein pour le premier step.
  const [display, setDisplay] = useState(() => {
    const s0 = steps[0]
    return { remainingSec: s0?.advance === 'auto' ? (s0.duration_sec ?? 0) : 0, fraction: 1 }
  })
  const [realSec, setRealSec] = useState(0)

  const [soundOn, setSoundOn] = useState(() => localStorage.getItem(SOUND_KEY) !== 'off')
  useEffect(() => { localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off') }, [soundOn])

  // Ancres temporelles du step courant (timestamps, jamais de décrément).
  const anchor = useRef({ start: 0, pausedAccum: 0, pausedAt: 0 })
  const startedAtRef = useRef(0)
  const wakeRef = useRef(null)
  // Vrai tant que l'entrée d'historique posée à l'ouverture est encore empilée.
  const historyOwned = useRef(false)

  // Horodatage de départ posé au montage (hors rendu).
  useEffect(() => { startedAtRef.current = Date.now() }, [])

  // Masque le header applicatif tant que le player occupe l'écran.
  useEffect(() => {
    setOverlay(true)
    return () => setOverlay(false)
  }, [setOverlay])

  const step = steps[cursor]
  const isAuto = step?.advance === 'auto'
  const isManual = step?.advance === 'manual'

  // ── Geste retour : intercepté, il demande confirmation ─────────────────────
  // Une entrée d'historique factice est empilée à l'ouverture. Le swipe retour
  // la dépile : on la remet en place et on ouvre le dialog au lieu de laisser
  // React Router revenir au dashboard par-dessous le player.
  useEffect(() => {
    window.history.pushState({ renfoPlayer: true }, '')
    historyOwned.current = true
    const onPop = () => {
      if (!historyOwned.current) return // sortie volontaire : on laisse filer
      window.history.pushState({ renfoPlayer: true }, '')
      setConfirmQuit(true)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Sortie volontaire : consomme l'entrée d'historique avant de rendre la main.
  const leave = useCallback((done) => {
    if (historyOwned.current) {
      historyOwned.current = false
      window.history.back()
    }
    done()
  }, [])

  // ── Wake Lock : maintien de l'écran allumé ─────────────────────────────────
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

  // Libère les éléments audio à la sortie du player.
  useEffect(() => () => { beeps?.dispose?.() }, [beeps])

  // ── Temps écoulé dans le step courant (ms), pauses déduites ─────────────────
  const stepElapsedMs = useCallback(() => {
    const a = anchor.current
    const live = a.pausedAt ? Date.now() - a.pausedAt : 0
    return Date.now() - a.start - a.pausedAccum - live
  }, [])

  // Repose l'ancre temporelle (changement de step ou reset du step courant).
  const reanchor = useCallback(() => {
    anchor.current = { start: Date.now(), pausedAccum: 0, pausedAt: paused ? Date.now() : 0 }
  }, [paused])

  // Réinitialise l'ancre à chaque changement de step (écriture de ref
  // uniquement ; le décompte est réinitialisé par les handlers de nav).
  useEffect(() => {
    reanchor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor])

  // Réinitialise le décompte pour le step d'index `idx`.
  const primeStep = useCallback((idx) => {
    const s = steps[idx]
    setDisplay({ remainingSec: s?.advance === 'auto' ? (s.duration_sec ?? 0) : 0, fraction: 1 })
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

  // Recommence le step courant sans changer d'index.
  const resetStep = useCallback(() => {
    reanchor()
    primeStep(cursor)
  }, [reanchor, primeStep, cursor])

  // ── Boucle de tick des steps auto (250 ms), signal à zéro ──────────────────
  useEffect(() => {
    if (finished || !isAuto || paused) return undefined
    const id = setInterval(() => {
      const elapsed = stepElapsedMs() / 1000
      const remaining = step.duration_sec - elapsed
      if (remaining <= 0) {
        if (soundOn) beeps?.play?.(step.kind === 'work' ? 'double' : 'single')
        goNext()
      } else {
        setDisplay({
          remainingSec: Math.max(0, Math.ceil(remaining)),
          fraction: Math.max(0, Math.min(1, 1 - elapsed / step.duration_sec)),
        })
      }
    }, 250)
    return () => clearInterval(id)
  }, [finished, isAuto, paused, step, stepElapsedMs, soundOn, beeps, goNext])

  // Ajuste l'ancre hors de l'updater (StrictMode double-invoque les updaters).
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

  // Décompte issu de l'état alimenté par la boucle de tick.
  const { remainingSec, fraction } = display
  const next = steps[cursor + 1]
  const progress = steps.length ? Math.round((cursor / steps.length) * 100) : 100

  // ── Habillage plein écran ──────────────────────────────────────────────────
  const shell = {
    position: 'fixed', inset: 0, zIndex: 2000,
    bgcolor: 'background.default',
    display: 'flex', flexDirection: 'column',
    pt: 'max(12px, env(safe-area-inset-top, 0px))',
    // Rangée de contrôles décollée du bord bas (pouce + barre système iOS).
    pb: 'calc(max(16px, env(safe-area-inset-bottom, 0px)) + 24px)',
    pl: 'max(16px, env(safe-area-inset-left, 0px))',
    pr: 'max(16px, env(safe-area-inset-right, 0px))',
  }

  if (finished) {
    return createPortal(
      <Box sx={shell}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', maxWidth: 460, mx: 'auto', width: '100%', textAlign: 'center', px: 1 }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%', mb: 2.5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: ZONE_STYLE.renfo.bg, color: ACCENT,
          }}>
            <Check sx={{ fontSize: 40 }} />
          </Box>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>Séance terminée</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Beau travail. Enregistre ton ressenti pour affiner la suite.
          </Typography>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 3.5, width: '100%' }}>
            <RecapTile value={formatGoalTime(realSec)} label="temps réel" />
            <RecapTile value={formatGoalTime(totalSeconds)} label="estimé" />
            <RecapTile value={String(exerciseCount)} label={exerciseCount > 1 ? 'exercices' : 'exercice'} />
          </Box>

          <Button
            fullWidth variant="contained" onClick={() => leave(onValidate)}
            sx={{ mt: 4, height: 52, borderRadius: '26px', textTransform: 'none', fontWeight: 700, fontSize: '1rem', boxShadow: 'none', bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}
          >
            Valider la séance
          </Button>
          <Button
            fullWidth variant="text" onClick={() => leave(onClose)}
            sx={{ mt: 1, height: 46, borderRadius: '23px', textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Fermer
          </Button>
        </Box>
      </Box>,
      document.body,
    )
  }

  const isRest = step?.kind === 'rest'
  const isPrep = step?.kind === 'prep'
  const centreColor = ACCENT

  return createPortal(
    <Box sx={shell}>
      {/* Barre du haut : fermer + son */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexShrink: 0 }}>
        <IconButton onClick={() => setConfirmQuit(true)} sx={{ color: 'text.secondary' }} aria-label="Fermer">
          <Close />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={() => setSoundOn((s) => !s)} sx={{ color: soundOn ? ACCENT : 'text.disabled' }} aria-label="Son">
          {soundOn ? <VolumeUp /> : <VolumeOff />}
        </IconButton>
      </Box>

      {/* Progression globale */}
      <LinearProgress
        variant="determinate" value={progress}
        sx={{ height: 5, borderRadius: 3, flexShrink: 0, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: ACCENT, borderRadius: 3 } }}
      />

      {/* Zone step courant */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 460, mx: 'auto', width: '100%', minHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={cursor}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            <Box sx={{ textAlign: 'center', px: 1 }}>
              {/* En-tête step */}
              {isRest || isPrep ? (
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'text.disabled' }}>
                  {isPrep ? 'Préparation' : 'Récupération'}
                </Typography>
              ) : (
                <>
                  {step?.theme && (
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: ACCENT }}>
                      {cleanText(step.theme)}
                    </Typography>
                  )}
                  <Typography variant="h4" fontWeight={800} sx={{ mt: 0.5, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    {step?.exercise?.name}
                  </Typography>
                </>
              )}

              {/* Série + côté */}
              {step && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {isPrep
                    ? 'En place pour le premier exercice'
                    : isRest
                      ? (next ? `Avant : ${next.exercise?.name}` : 'Dernière récupération')
                      : [`Série ${step.setIndex}/${step.setCount}`, step.side && `Côté ${step.side}`].filter(Boolean).join(' · ')}
                </Typography>
              )}

              {/* Consigne, toujours visible */}
              {step?.exercise?.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 1, mx: 'auto', maxWidth: 380, lineHeight: 1.5, fontSize: '0.78rem',
                    display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, overflow: 'hidden',
                  }}
                >
                  {cleanText(step.exercise.description)}
                </Typography>
              )}

              {/* Décompte / reps */}
              <Box sx={{ mt: 3, mb: 2 }}>
                {isAuto ? (
                  <ProgressRing
                    fraction={fraction}
                    remainingSec={remainingSec}
                    sub={isRest ? 'repos' : (paused ? 'en pause' : null)}
                    color={isRest || isPrep ? '#94a3b8' : ACCENT}
                  />
                ) : (
                  <Box sx={{ py: 2 }}>
                    <Typography sx={{ fontSize: '5rem', fontWeight: 800, lineHeight: 1, color: centreColor, fontVariantNumeric: 'tabular-nums' }}>
                      {step?.reps}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'text.secondary', mt: 0.5 }}>
                      répétitions
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      {/* Bas : aperçu suivant + contrôles */}
      <Box sx={{ maxWidth: 460, mx: 'auto', width: '100%', flexShrink: 0 }}>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mb: 2, minHeight: 18 }}>
          {next ? `À suivre : ${nextLabel(next)}` : 'Dernier effort'}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <IconButton onClick={resetStep} sx={{ width: 40, height: 40, color: 'text.disabled' }} aria-label="Recommencer">
            <RestartAlt sx={{ fontSize: 22 }} />
          </IconButton>
          <IconButton onClick={goPrev} disabled={cursor === 0} sx={{ color: 'text.secondary' }} aria-label="Précédent">
            <SkipPrevious sx={{ fontSize: 32 }} />
          </IconButton>

          {/* Bouton central : valide la série sur un step en répétitions,
              met en pause sur un step chronométré. */}
          <IconButton
            onClick={isManual ? goNext : togglePause}
            aria-label={isManual ? 'Série terminée' : (paused ? 'Reprendre' : 'Pause')}
            sx={{
              width: 72, height: 72,
              border: '2px solid', borderColor: ACCENT,
              color: isManual ? 'common.white' : ACCENT,
              bgcolor: isManual ? ACCENT : 'transparent',
              '&:hover': { bgcolor: isManual ? ACCENT : 'action.hover' },
            }}
          >
            {isManual
              ? <Check sx={{ fontSize: 40 }} />
              : (paused ? <PlayArrow sx={{ fontSize: 32 }} /> : <Pause sx={{ fontSize: 32 }} />)}
          </IconButton>

          <IconButton onClick={goNext} sx={{ color: 'text.secondary' }} aria-label="Suivant">
            <SkipNext sx={{ fontSize: 32 }} />
          </IconButton>
          {/* Contrepoids du bouton reset : garde le bouton central centré. */}
          <Box sx={{ width: 40, flexShrink: 0 }} />
        </Box>
      </Box>

      <Dialog
        open={confirmQuit}
        onClose={() => setConfirmQuit(false)}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Quitter la séance ?</DialogTitle>
        <DialogContent>
          <DialogContentText>La progression sera perdue.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmQuit(false)} color="inherit">Continuer</Button>
          <Button onClick={() => leave(onClose)} variant="contained" sx={{ bgcolor: ACCENT, '&:hover': { bgcolor: ACCENT } }}>Quitter</Button>
        </DialogActions>
      </Dialog>
    </Box>,
    document.body,
  )
}

const RecapTile = ({ value, label }) => (
  <Box sx={{ flex: 1, py: 1.75, borderRadius: '16px', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.66rem' }}>{label}</Typography>
  </Box>
)

export default RenfoPlayer
