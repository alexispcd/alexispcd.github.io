import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { useOnline } from '../../../hooks/useOnline'
import {
  Box, Typography, Button, CircularProgress, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Menu, MenuItem,
} from '@mui/material'
import LocalFireDepartment from '@mui/icons-material/LocalFireDepartmentOutlined'
import Bolt from '@mui/icons-material/BoltOutlined'
import DirectionsRun from '@mui/icons-material/DirectionsRunOutlined'
import PauseCircle from '@mui/icons-material/PauseCircleOutlined'
import Bedtime from '@mui/icons-material/BedtimeOutlined'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import ExpandMore from '@mui/icons-material/ExpandMore'
import Redo from '@mui/icons-material/Redo'
import CheckCircle from '@mui/icons-material/CheckCircle'
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import ReportProblem from '@mui/icons-material/ReportProblemOutlined'
import Watch from '@mui/icons-material/WatchOutlined'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { glassSx, cardSx, GLASS_BACKDROP } from '../../../styles/glass'
import {
  getSession, skipSession, unskipSession, adaptSessions,
  completeSession, resetSession, updateOnCoros,
} from '../../../lib/training'
import {
  ZONE_STYLE, ZONE_LABEL, TYPE_LABEL, STATUS_LABEL, ADAPTED_STYLE, VERDICT,
  intensityOf, formatKm, formatPace, formatDistance, formatDuration, formatMin,
  cleanText, shortDayLabel, formatLongDay, isCorosCopyUpcoming,
} from '../constants'
import {
  groupSteps, totalMeters, totalSeconds, keyPaceSec, stepSizeLabel,
} from '../sessionMath'
import PaceChart from './PaceChart'
import CompleteDialog from './CompleteDialog'
import CorosPushDialog from './CorosPushDialog'

// ── Styles de chips de statut ────────────────────────────────────────────────
const STATUS_CHIP = {
  planned: { main: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  done:    { main: ZONE_STYLE.A.main, bg: ZONE_STYLE.A.bg },
  adapted: ADAPTED_STYLE,
  skipped: { main: '#94a3b8', bg: 'rgba(148,163,184,0.16)' },
}

const STEP_ICON = {
  warmup: LocalFireDepartment,
  interval: Bolt,
  run: DirectionsRun,
  recovery: PauseCircle,
  cooldown: Bedtime,
}

// Icônes de verdict (labels + couleurs partagés via constants).
const VERDICT_ICON = {
  reussie: CheckCircle,
  partiellement: ErrorOutline,
  a_retravailler: ReportProblem,
}

const SessionPage = () => {
  const { planId, sessionId } = useParams()
  const navigate = useAppNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false) // action en cours (reset, délier…)
  // Hors ligne : lecture seule (aucune écriture, aucune Edge Function).
  const online = useOnline()
  const locked = busy || !online
  const [snack, setSnack] = useState(null)

  const [completeOpen, setCompleteOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [adapting, setAdapting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [pushOpen, setPushOpen] = useState(false)
  const [watchAnchor, setWatchAnchor] = useState(null) // menu "Sur la montre"

  const flash = (message, severity = 'error') => setSnack({ message, severity })
  const backToDashboard = () => navigate(`/training/plan/${planId}`)

  const reload = useCallback(async () => {
    const s = await getSession(sessionId)
    setSession(s)
    return s
  }, [sessionId])

  // Changement de séance : état de chargement remis au rendu, l'effet ne fait que charger.
  const [prevSessionId, setPrevSessionId] = useState(sessionId)
  if (sessionId !== prevSessionId) {
    setPrevSessionId(sessionId)
    setLoading(true)
    setLoadError(null)
  }

  useEffect(() => {
    let cancelled = false
    getSession(sessionId)
      .then((s) => { if (!cancelled) { setSession(s); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setLoadError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [sessionId])

  // ── Handlers ────────────────────────────────────────────────────────────────
  const doSkip = async () => {
    try {
      await skipSession(sessionId)
      setSkipOpen(true)
    } catch (e) { flash(e.message) }
  }

  const handleAdapt = async () => {
    setAdapting(true)
    try {
      const { sessions: adapted } = await adaptSessions(sessionId)
      const n = adapted?.length ?? 0
      flash(n > 0 ? `${n} séance${n > 1 ? 's' : ''} adaptée${n > 1 ? 's' : ''}` : 'Aucune séance à adapter', 'success')
    } catch (e) {
      flash(e.message)
    } finally {
      setAdapting(false)
      setSkipOpen(false)
      backToDashboard()
    }
  }

  const handleCancelSkip = async () => {
    setSkipOpen(false)
    try { await unskipSession(sessionId) } catch (e) { flash(e.message) }
    backToDashboard()
  }

  const doReset = async () => {
    setConfirmReset(false)
    setBusy(true)
    try {
      await resetSession(sessionId)
      await reload()
    } catch (e) { flash(e.message) } finally { setBusy(false) }
  }

  const doDelink = async () => {
    setBusy(true)
    try {
      await resetSession(sessionId)
      await completeSession(sessionId)
      await reload()
    } catch (e) { flash(e.message) } finally { setBusy(false) }
  }

  const doRestore = async () => {
    setBusy(true)
    try {
      const { corosError } = await unskipSession(sessionId)
      await reload()
      if (corosError) flash(`Séance restaurée, mais pas sur la montre : ${corosError}`, 'warning')
    } catch (e) { flash(e.message) } finally { setBusy(false) }
  }

  const onPushed = (res) => {
    setPushOpen(false)
    flash(
      res?.previous_copy?.upcoming
        ? "Séance envoyée. Supprime l'ancienne copie dans l'app Coros."
        : 'Séance envoyée vers la montre',
      'success',
    )
    reload().catch((e) => flash(e.message))
  }

  // Remplace le contenu de la copie Coros par la version actuelle de la séance.
  const doUpdateCoros = async () => {
    setWatchAnchor(null)
    setBusy(true)
    try {
      const res = await updateOnCoros(sessionId)
      if (res.status === 'updated') flash('Montre mise à jour', 'success')
      else if (res.status === 'past') flash('La séance sur la montre est déjà passée.', 'info')
      else flash(res.error ?? 'Mise à jour de la montre impossible.', 'warning')
      await reload()
    } catch (e) { flash(e.message) } finally { setBusy(false) }
  }

  // ── États de rendu ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pt: `${HEADER_HEIGHT}px` }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  if (loadError) {
    return (
      <Box sx={{ px: 2, pt: `${HEADER_HEIGHT + 16}px` }}>
        <Alert severity="error">{loadError}</Alert>
      </Box>
    )
  }

  const { zone, type, status, steps } = session
  const isDone = status === 'done'
  const isSkipped = status === 'skipped'
  const isAdapted = status === 'adapted'
  const canComplete = status === 'planned' || status === 'adapted'
  const canPush = canComplete
  const isPushed = Boolean(session.coros_workout_id)

  // Couleur dérivée de l'intensité du type ; le chip garde ZONE_LABEL[zone] :
  // la lettre reste le repère temporel, seule la couleur suit l'intensité.
  const zoneStyle = ZONE_STYLE[intensityOf(type)] ?? ZONE_STYLE.A
  const statusStyle = STATUS_CHIP[status] ?? STATUS_CHIP.planned

  // Séance à venir : la date n'est plus affichée (placement par zone, date indicative).
  // Une fois faite, on montre le jour réel ; sautée, on l'indique.
  const weekLabel = session.week_number != null ? `Semaine ${session.week_number}` : ''
  const metaLine = isDone
    ? [shortDayLabel(session.completed_at) ? `Fait ${shortDayLabel(session.completed_at)}` : 'Faite', weekLabel].filter(Boolean).join(' · ')
    : isSkipped
      ? ['Sautée', weekLabel].filter(Boolean).join(' · ')
      : weekLabel

  const analysis = session.analysis
  const laps = session.actual_laps
  const hasHr = [...(laps ?? []), ...(session.km_laps ?? [])].some((l) => l?.avg_hr != null)

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: (canComplete || isDone) ? '90px' : 6 }}>

        {/* ── En-tête ─────────────────────────────────────────────── */}
        <Box sx={{ ...cardSx, borderRadius: '20px', p: 2.25, mt: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
            <StatusChip label={ZONE_LABEL[zone]} main={zoneStyle.main} bg={zoneStyle.bg} />
            <StatusChip label={TYPE_LABEL[type]} />
            <StatusChip label={STATUS_LABEL[status]} main={statusStyle.main} bg={statusStyle.bg} />
          </Box>

          <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
            {cleanText(session.title)}
          </Typography>
          {metaLine && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              {metaLine}
            </Typography>
          )}

          <Box sx={{ display: 'flex', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}>
            {totalMeters(steps) > 0 && <Metric value={`${formatKm(totalMeters(steps))} km`} label="distance" />}
            {totalSeconds(steps) > 0 && <Metric value={`~${formatMin(Math.round(totalSeconds(steps) / 60))}`} label="durée" />}
            {keyPaceSec(steps) != null && <Metric value={`${formatPace(keyPaceSec(steps))} /km`} label="allure clé" />}
          </Box>
        </Box>

        {/* ── Bandeau séance adaptée ──────────────────────────────── */}
        {isAdapted && (
          <Banner
            icon={<AutoAwesome sx={{ fontSize: 18, color: '#a78bfa' }} />}
            text="Séance adaptée suite à une séance sautée."
            action="Restaurer la version d'origine"
            onAction={doRestore}
            disabled={locked}
          />
        )}

        {/* ── Bandeau séance sautée ───────────────────────────────── */}
        {isSkipped && (
          <Banner
            icon={<Redo sx={{ fontSize: 18, color: 'text.disabled' }} />}
            text="Séance sautée."
            action="Reprendre la séance"
            onAction={doRestore}
            disabled={locked}
          />
        )}
        {isSkipped && isCorosCopyUpcoming(session) && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            Toujours sur ta montre : supprime-la dans l'app Coros.
          </Typography>
        )}

        {/* ── Corps ───────────────────────────────────────────────── */}
          {/* Graphique */}
          <SectionLabel>Allure</SectionLabel>
          <Box sx={{ ...cardSx, borderRadius: '20px', p: 1.5, pb: 1 }}>
            <ChartLegend synced={Boolean(laps?.length)} hasHr={hasHr} />
            <PaceChart steps={steps} actualLaps={laps} kmLaps={session.km_laps} comparisons={analysis?.comparisons ?? []} />
          </Box>

          {/* Structure */}
          <SectionLabel>Structure</SectionLabel>
          <Box sx={{ ...cardSx, borderRadius: '20px', py: 0.5 }}>
            <StepsList steps={steps} type={type} />
          </Box>

          {/* Envoi vers la montre (MCP Coros) */}
          {canPush && (
            <Box sx={{ mt: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<Watch />}
                endIcon={isPushed ? <ExpandMore /> : undefined}
                onClick={isPushed ? (e) => setWatchAnchor(e.currentTarget) : () => setPushOpen(true)}
                disabled={locked}
                sx={{
                  height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 600,
                  boxShadow: 'none', borderColor: 'divider', color: 'text.primary',
                }}
              >
                {isPushed ? 'Sur la montre' : 'Envoyer vers la montre'}
              </Button>
              {isPushed && session.coros_workout_date && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}>
                  {`Prévue le ${formatLongDay(session.coros_workout_date)} sur Coros`}
                </Typography>
              )}
              {isPushed && session.coros_sync_error && (
                <Typography variant="caption" color="warning.main" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
                  {session.coros_sync_error}{' '}
                  <Box
                    component="button"
                    onClick={doUpdateCoros}
                    disabled={locked}
                    sx={{
                      p: 0, border: 0, bgcolor: 'transparent', font: 'inherit', fontWeight: 700,
                      color: 'primary.main', cursor: 'pointer', textDecoration: 'underline',
                    }}
                  >
                    Réessayer
                  </Box>
                </Typography>
              )}
              <Menu
                anchorEl={watchAnchor}
                open={Boolean(watchAnchor)}
                onClose={() => setWatchAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
                slotProps={{ paper: { sx: { ...glassSx, borderRadius: '16px', minWidth: 220, mt: 0.5 } } }}
              >
                <MenuItem onClick={doUpdateCoros} disabled={!online}>Mettre à jour</MenuItem>
                <MenuItem onClick={() => { setWatchAnchor(null); setPushOpen(true) }} disabled={!online}>
                  Envoyer à une autre date
                </MenuItem>
              </Menu>
            </Box>
          )}

          {/* Justification */}
          {session.rationale && (
            <>
              <SectionLabel>Pourquoi ces allures</SectionLabel>
              <Box sx={{ ...cardSx, borderRadius: '20px', p: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  {cleanText(session.rationale)}
                </Typography>
              </Box>
            </>
          )}

          {/* Analyse */}
          {analysis && (
            <>
              <SectionLabel>Analyse</SectionLabel>
              <Box sx={{ ...cardSx, borderRadius: '20px', p: 2 }}>
                <AnalysisBlock analysis={analysis} />
              </Box>
            </>
          )}


      </Box>

      {/* ── Barre d'actions fixe (pattern wizard/Côtes) ─────────────
          Coins concentriques : radius carte = INSET (10) + radius bouton (24) = 34. */}
      {(canComplete || isDone) && (
        <Box sx={{
          position: 'fixed', zIndex: 1200,
          left: '4vw', right: '4vw', maxWidth: 620, mx: 'auto',
          bottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          borderRadius: '34px', overflow: 'hidden', ...glassSx,
        }}>
          <Box sx={{ p: '10px', display: 'flex', gap: 1 }}>
            {canComplete && (
              <>
                <Button
                  variant="outlined"
                  onClick={doSkip}
                  disabled={locked}
                  sx={{
                    flexShrink: 0, px: 2.5, height: 48, borderRadius: '24px',
                    textTransform: 'none', fontWeight: 600, boxShadow: 'none',
                    borderColor: 'divider', color: 'text.secondary',
                  }}
                >
                  Sauter
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => setCompleteOpen(true)}
                  disabled={locked}
                  sx={{ height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 600, boxShadow: 'none' }}
                >
                  {busy
                    ? <CircularProgress size={18} color="inherit" />
                    : 'Valider & lier Coros'}
                </Button>
              </>
            )}
            {isDone && (
              <>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => setConfirmReset(true)}
                  disabled={locked}
                  sx={{
                    height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 600,
                    boxShadow: 'none', borderColor: 'divider', color: 'text.secondary',
                  }}
                >
                  {busy ? <CircularProgress size={18} color="inherit" /> : 'Réinitialiser'}
                </Button>
                {session.coros_activity_id && (
                  <Button
                    variant="outlined"
                    onClick={doDelink}
                    disabled={locked}
                    sx={{
                      flexShrink: 0, px: 2.5, height: 48, borderRadius: '24px',
                      textTransform: 'none', fontWeight: 600, boxShadow: 'none',
                      borderColor: 'divider', color: 'text.secondary',
                    }}
                  >
                    Délier Coros
                  </Button>
                )}
              </>
            )}
          </Box>
        </Box>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────── */}
      <CompleteDialog
        open={completeOpen}
        sessionId={sessionId}
        scheduledDate={session.scheduled_date}
        onClose={() => setCompleteOpen(false)}
        onDone={() => { setCompleteOpen(false); reload().catch((e) => flash(e.message)) }}
      />

      <CorosPushDialog
        open={pushOpen}
        session={session}
        onClose={() => setPushOpen(false)}
        onDone={onPushed}
      />

      <Dialog
        open={skipOpen}
        // Hors ligne, fermer garde la séance sautée (déjà enregistrée) : l'annulation écrit en base.
        onClose={() => { if (adapting) return; if (online) handleCancelSkip(); else { setSkipOpen(false); backToDashboard() } }}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Adapter les séances suivantes ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {adapting
              ? 'Adaptation en cours… tu peux patienter ici.'
              : `« ${cleanText(session.title)} » est marquée comme sautée. Veux-tu recalibrer les prochaines séances en conséquence ?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelSkip} disabled={adapting || !online} color="inherit">Annuler</Button>
          <Button onClick={handleAdapt} disabled={adapting || !online} variant="contained">
            {adapting ? <CircularProgress size={18} color="inherit" /> : 'Adapter'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Réinitialiser la séance ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            La séance repassera « à venir ». Les laps importés et l'analyse seront effacés.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmReset(false)} color="inherit">Annuler</Button>
          <Button onClick={doReset} disabled={!online} variant="contained">Réinitialiser</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.message}
        </Alert>
      </Snackbar>

    </Box>
  )
}

// ── Sous-composants ──────────────────────────────────────────────────────────

const StatusChip = ({ label, main, bg }) => (
  <Box sx={{
    px: 1.25, py: 0.5, borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
    letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
    color: main ?? 'text.secondary',
    bgcolor: bg ?? 'action.hover',
    border: main ? '1px solid' : 'none',
    borderColor: main ? main : 'transparent',
  }}>
    {label}
  </Box>
)

const Metric = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{label}</Typography>
  </Box>
)

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, px: 0.5 }}
  >
    {children}
  </Typography>
)

const Banner = ({ icon, text, action, onAction, disabled }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1.25, mt: 1.5, px: 1.75, py: 1.25,
    borderRadius: '14px', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover',
  }}>
    {icon}
    <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>{text}</Typography>
    <Button size="small" onClick={onAction} disabled={disabled} sx={{ flexShrink: 0, fontSize: '0.68rem' }}>
      {action}
    </Button>
  </Box>
)

const ChartLegend = ({ synced, hasHr }) => (
  <Box sx={{ display: 'flex', gap: 1.5, px: 1, pb: 1, flexWrap: 'wrap' }}>
    <LegendItem color="rgba(96,165,250,0.5)" label="Cible ± tolérance" />
    {synced && <LegendItem color="text.secondary" label="Réalisé" />}
    {hasHr && <LegendItem color="rgba(244,63,94,0.55)" label="FC" />}
    {synced && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Dot color="primary.main" />
        <Dot color="#eab308" />
        <Dot color="#ef4444" />
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>ok / proche / écart</Typography>
      </Box>
    )}
  </Box>
)
const LegendItem = ({ color, label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <Dot color={color} />
    <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>{label}</Typography>
  </Box>
)
const Dot = ({ color }) => (
  <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: color }} />
)

// ── Liste des steps (structure) ──────────────────────────────────────────────

const recoveryLabel = (steps) => {
  const rec = steps.find((s) => s.step_type === 'recovery')
  if (!rec) return null
  const size = formatDuration(rec.duration_sec) ?? formatDistance(rec.distance_m)
  return size ? `récup ${size} entre chaque` : null
}

const StepsList = ({ steps, type }) => {
  const groups = groupSteps(steps)
  return groups.map((g, i) => {
    if (g.kind === 'repeat') {
      const reps = g.steps.filter((s) => s.step_type === 'interval')
      const base = reps[0] ?? g.steps[0]
      return (
        <StepRow
          key={i}
          first={i === 0}
          stepType="interval"
          name={`${reps.length} × ${stepSizeLabel(base)}`}
          detail={recoveryLabel(g.steps)}
          pace={base.target_pace_sec}
          tol={base.pace_tolerance_sec}
        />
      )
    }
    const s = g.steps[0]
    const name = {
      warmup: 'Échauffement',
      cooldown: 'Retour au calme',
      recovery: 'Récupération',
      run: TYPE_LABEL[type] ?? 'Course',
    }[s.step_type] ?? 'Course'
    return (
      <StepRow
        key={i}
        first={i === 0}
        stepType={s.step_type}
        name={name}
        detail={stepSizeLabel(s)}
        pace={s.target_pace_sec}
      />
    )
  })
}

const StepRow = ({ first, stepType, name, detail, pace, tol, }) => {
  const Icon = STEP_ICON[stepType] ?? DirectionsRun
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
      borderTop: first ? 'none' : '1px solid', borderColor: 'divider',
    }}>
      <Box sx={{
        width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover',
      }}>
        <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600}>{name}</Typography>
        {detail && (
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {detail}
          </Typography>
        )}
      </Box>
      {pace != null && (
        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatPace(pace)}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
            {tol != null ? `±${tol}s /km` : '/km'}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// ── Analyse ──────────────────────────────────────────────────────────────────

const AnalysisBlock = ({ analysis }) => {
  const { verdict, advice, comparisons } = analysis
  const graded = (comparisons ?? []).filter((c) => c.status !== 'free')
  const nOk = graded.filter((c) => c.status === 'ok').length
  const v = verdict ? VERDICT[verdict] : null

  if (!v) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          {graded.length > 0
            ? `${nOk} lap${nOk > 1 ? 's' : ''} sur ${graded.length} dans la cible. Analyse détaillée indisponible.`
            : 'Analyse indisponible.'}
        </Typography>
      </Box>
    )
  }

  const { color, label } = v
  const Icon = VERDICT_ICON[verdict] ?? CheckCircle
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: '12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${color}22`,
        }}>
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
        <Box>
          <Typography variant="body2" fontWeight={700} sx={{ color }}>{label}</Typography>
          {graded.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {nOk} lap{nOk > 1 ? 's' : ''} sur {graded.length} dans la cible
            </Typography>
          )}
        </Box>
      </Box>
      {advice && (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{cleanText(advice)}</Typography>
      )}
    </Box>
  )
}

export default SessionPage
