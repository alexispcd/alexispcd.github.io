import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Button, CircularProgress, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import LocalFireDepartment from '@mui/icons-material/LocalFireDepartmentOutlined'
import Bolt from '@mui/icons-material/BoltOutlined'
import DirectionsRun from '@mui/icons-material/DirectionsRunOutlined'
import PauseCircle from '@mui/icons-material/PauseCircleOutlined'
import Bedtime from '@mui/icons-material/BedtimeOutlined'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import Redo from '@mui/icons-material/Redo'
import CheckCircle from '@mui/icons-material/CheckCircle'
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined'
import ReportProblem from '@mui/icons-material/ReportProblemOutlined'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import {
  getSession, skipSession, unskipSession, adaptSessions,
  completeSession, resetSession,
} from '../../../lib/training'
import {
  ZONE_STYLE, ZONE_LABEL, TYPE_LABEL, STATUS_LABEL,
  formatKm, formatPace, formatDistance, formatDuration,
} from '../constants'
import {
  groupSteps, totalMeters, totalSeconds, keyPaceSec, stepSizeLabel,
} from './sessionMath'
import PaceChart from './PaceChart'
import CompleteDialog from './CompleteDialog'

// ── Styles de chips de statut ────────────────────────────────────────────────
const STATUS_CHIP = {
  planned: { main: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  done:    { main: ZONE_STYLE.A.main, bg: ZONE_STYLE.A.bg },
  adapted: { main: '#a78bfa', bg: 'rgba(167,139,250,0.16)' },
  skipped: { main: '#94a3b8', bg: 'rgba(148,163,184,0.16)' },
}

const STEP_ICON = {
  warmup: LocalFireDepartment,
  interval: Bolt,
  run: DirectionsRun,
  recovery: PauseCircle,
  cooldown: Bedtime,
}

const VERDICT = {
  reussie:        { label: 'Séance réussie', color: ZONE_STYLE.A.main, Icon: CheckCircle },
  partiellement:  { label: 'Séance partiellement réussie', color: '#eab308', Icon: ErrorOutline },
  a_retravailler: { label: 'À retravailler', color: '#ef4444', Icon: ReportProblem },
}

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const SessionPage = () => {
  const { planId, sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [busy, setBusy] = useState(false) // action en cours (valider renfo, reset, délier…)
  const [snack, setSnack] = useState(null)

  const [completeOpen, setCompleteOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [adapting, setAdapting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const flash = (message, severity = 'error') => setSnack({ message, severity })
  const backToDashboard = () => navigate(`/training/plan/${planId}`)

  const reload = useCallback(async () => {
    const s = await getSession(sessionId)
    setSession(s)
    return s
  }, [sessionId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
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

  const doCompleteRenfo = async () => {
    setBusy(true)
    try {
      await completeSession(sessionId)
      await reload()
    } catch (e) { flash(e.message) } finally { setBusy(false) }
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
      await unskipSession(sessionId)
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
  const isRenfo = type === 'renfo'
  const isDone = status === 'done'
  const isSkipped = status === 'skipped'
  const isAdapted = status === 'adapted'
  const canComplete = status === 'planned' || status === 'adapted'

  const zoneStyle = ZONE_STYLE[zone] ?? ZONE_STYLE.A
  const statusStyle = STATUS_CHIP[status] ?? STATUS_CHIP.planned

  const d = new Date(session.scheduled_date)
  const dateLabel = cap(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))

  const analysis = session.analysis
  const laps = session.actual_laps

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: 6 }}>

        {/* ── En-tête ─────────────────────────────────────────────── */}
        <Box sx={{ ...glassSx, borderRadius: '20px', p: 2.25, mt: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, mb: 1.25 }}>
            <StatusChip label={ZONE_LABEL[zone]} main={zoneStyle.main} bg={zoneStyle.bg} />
            {!isRenfo && <StatusChip label={TYPE_LABEL[type]} />}
            <StatusChip label={STATUS_LABEL[status]} main={statusStyle.main} bg={statusStyle.bg} />
          </Box>

          <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
            {session.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {dateLabel}{session.week_number != null ? ` · Semaine ${session.week_number}` : ''}
          </Typography>

          {!isRenfo && (
            <Box sx={{ display: 'flex', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}>
              {totalMeters(steps) > 0 && <Metric value={`${formatKm(totalMeters(steps))} km`} label="distance" />}
              {totalSeconds(steps) > 0 && <Metric value={`~${Math.round(totalSeconds(steps) / 60)} min`} label="durée" />}
              {keyPaceSec(steps) != null && <Metric value={`${formatPace(keyPaceSec(steps))} /km`} label="allure clé" />}
            </Box>
          )}
          {isRenfo && session.strength_content && (
            <Box sx={{ display: 'flex', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}>
              {session.strength_content.target_duration_min && (
                <Metric value={`${session.strength_content.target_duration_min} min`} label="durée" />
              )}
              {Array.isArray(session.strength_content.blocks) && (
                <Metric value={`${session.strength_content.blocks.length} blocs`} label="au programme" />
              )}
            </Box>
          )}
        </Box>

        {/* ── Bandeau séance adaptée ──────────────────────────────── */}
        {isAdapted && (
          <Banner
            icon={<AutoAwesome sx={{ fontSize: 18, color: '#a78bfa' }} />}
            text="Séance adaptée suite à une séance sautée."
            action="Restaurer la version d'origine"
            onAction={doRestore}
            disabled={busy}
          />
        )}

        {/* ── Bandeau séance sautée ───────────────────────────────── */}
        {isSkipped && (
          <Banner
            icon={<Redo sx={{ fontSize: 18, color: 'text.disabled' }} />}
            text="Séance sautée."
            action="Reprendre la séance"
            onAction={doRestore}
            disabled={busy}
          />
        )}

        {/* ── Corps ───────────────────────────────────────────────── */}
        {isRenfo ? (
          <RenfoBody content={session.strength_content} />
        ) : (
          <>
            {/* Graphique */}
            <SectionLabel>Allure par step</SectionLabel>
            <Box sx={{ ...glassSx, borderRadius: '20px', p: 1.5, pb: 1 }}>
              <ChartLegend synced={Boolean(laps?.length)} />
              <PaceChart steps={steps} actualLaps={laps} comparisons={analysis?.comparisons ?? []} />
            </Box>

            {/* Structure */}
            <SectionLabel>Structure</SectionLabel>
            <Box sx={{ ...glassSx, borderRadius: '20px', py: 0.5 }}>
              <StepsList steps={steps} type={type} />
            </Box>

            {/* Justification */}
            {session.rationale && (
              <>
                <SectionLabel>Pourquoi ces allures</SectionLabel>
                <Box sx={{ ...glassSx, borderRadius: '20px', p: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {session.rationale}
                  </Typography>
                </Box>
              </>
            )}

            {/* Analyse */}
            {analysis && (
              <>
                <SectionLabel>Analyse</SectionLabel>
                <Box sx={{ ...glassSx, borderRadius: '20px', p: 2 }}>
                  <AnalysisBlock analysis={analysis} />
                </Box>
              </>
            )}
          </>
        )}

        {/* ── Barre d'actions ─────────────────────────────────────── */}
        {canComplete && (
          <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5 }}>
            <Button fullWidth color="inherit" onClick={doSkip} disabled={busy}>Sauter</Button>
            {isRenfo ? (
              <Button fullWidth variant="contained" onClick={doCompleteRenfo} disabled={busy}>
                {busy ? <CircularProgress size={18} color="inherit" /> : 'Valider'}
              </Button>
            ) : (
              <Button fullWidth variant="contained" onClick={() => setCompleteOpen(true)} disabled={busy}>
                Valider &amp; lier Coros
              </Button>
            )}
          </Box>
        )}

        {isDone && (
          <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5 }}>
            <Button fullWidth color="inherit" onClick={() => setConfirmReset(true)} disabled={busy}>
              {busy ? <CircularProgress size={18} color="inherit" /> : 'Réinitialiser'}
            </Button>
            {session.coros_activity_id && (
              <Button fullWidth color="inherit" onClick={doDelink} disabled={busy}>Délier Coros</Button>
            )}
          </Box>
        )}
      </Box>

      {/* ── Dialogs ──────────────────────────────────────────────── */}
      <CompleteDialog
        open={completeOpen}
        sessionId={sessionId}
        onClose={() => setCompleteOpen(false)}
        onDone={() => { setCompleteOpen(false); reload().catch((e) => flash(e.message)) }}
      />

      <Dialog
        open={skipOpen}
        onClose={() => !adapting && handleCancelSkip()}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Adapter les séances suivantes ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {adapting
              ? 'Adaptation en cours… tu peux patienter ici.'
              : `« ${session.title} » est marquée comme sautée. Veux-tu recalibrer les prochaines séances en conséquence ?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelSkip} disabled={adapting} color="inherit">Annuler</Button>
          <Button onClick={handleAdapt} disabled={adapting} variant="contained">
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
          <Button onClick={doReset} variant="contained">Réinitialiser</Button>
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

const ChartLegend = ({ synced }) => (
  <Box sx={{ display: 'flex', gap: 1.5, px: 1, pb: 1, flexWrap: 'wrap' }}>
    <LegendItem color="rgba(96,165,250,0.5)" label="Cible ± tolérance" />
    {synced && <LegendItem color="text.secondary" label="Réalisé" />}
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

// ── Corps renfo ──────────────────────────────────────────────────────────────

const exoDuration = (sec) => {
  if (!sec) return null
  if (sec < 60) return `${sec} s`
  if (sec % 60 === 0) return `${sec / 60} min`
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`
}

const exoDetail = (ex) => {
  const sets = ex.sets ? `${ex.sets} × ` : ''
  const load = ex.reps != null ? `${ex.reps}` : (exoDuration(ex.duration_sec) ?? '')
  const rest = ex.rest_sec != null ? ` · repos ${ex.rest_sec} s` : ''
  return `${sets}${load}${rest}`.trim()
}

const RenfoBody = ({ content }) => {
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  if (!blocks.length) {
    return (
      <Box sx={{ ...glassSx, borderRadius: '20px', p: 3, mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">Contenu de la séance indisponible.</Typography>
      </Box>
    )
  }
  return (
    <>
      <SectionLabel>Programme</SectionLabel>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {blocks.map((b, i) => {
          const exos = Array.isArray(b.exercises) ? b.exercises : []
          return (
            <Box key={i} sx={{ ...glassSx, borderRadius: '20px', overflow: 'hidden' }}>
              <Box sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider',
              }}>
                <Typography variant="body2" fontWeight={700}>{b.name}</Typography>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                  {exos.length} exercice{exos.length > 1 ? 's' : ''}
                </Typography>
              </Box>
              {exos.map((ex, j) => (
                <Box key={j} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5,
                  px: 2, py: 1.25, borderTop: j === 0 ? 'none' : '1px solid', borderColor: 'divider',
                }}>
                  <Typography variant="body2">{ex.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: 'right', flexShrink: 0 }}>
                    {exoDetail(ex)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )
        })}
      </Box>
    </>
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

  const { Icon, color, label } = v
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
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{advice}</Typography>
      )}
    </Box>
  )
}

export default SessionPage
