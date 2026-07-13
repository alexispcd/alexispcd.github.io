import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box, Typography, Chip, Button, CircularProgress, Alert, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import EmojiEvents from '@mui/icons-material/EmojiEvents'
import Autorenew from '@mui/icons-material/Autorenew'
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined'
import History from '@mui/icons-material/History'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { useAppCtx } from '../../../lib/context'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import {
  getPlan, getWeekSessions, subscribeToPlan,
  skipSession, unskipSession, adaptSessions,
  regeneratePlan, archivePlan, deletePlan, generatePlan,
} from '../../../lib/training'
import {
  BLOCK_STYLE, ZONE_STYLE, BLOCK_LABEL, PLAN_STATUS_LABEL,
  ZONE_LABEL, ZONE_SUBLABEL, ZONE_DAYS,
  formatGoalTime, formatKm, daysUntil, currentWeekNumber, formatWeekRange,
  groupSessionsByZone, cleanText,
} from '../constants'
import SessionRow from './SessionRow'

const PlanDashboard = () => {
  const { planId } = useParams()
  const navigate = useNavigate()
  const { setHeaderActions } = useAppCtx()

  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [regenBusy, setRegenBusy] = useState(false)

  // Semaine sélectionnée : null tant que l'utilisateur n'a pas choisi → on retombe
  // sur la semaine courante (état dérivé plutôt que miroir dans un effet).
  // Persistée en sessionStorage pour survivre à un aller-retour vers une séance.
  const weekStorageKey = `training:selectedWeek:${planId}`
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const v = sessionStorage.getItem(`training:selectedWeek:${planId}`)
    return v ? Number(v) : null
  })
  const [sessions, setSessions] = useState(null)

  const [skipDialog, setSkipDialog] = useState(null)
  const [adapting, setAdapting] = useState(false)
  const [confirmRegen, setConfirmRegen] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [snack, setSnack] = useState(null)
  const [genTimedOut, setGenTimedOut] = useState(false)

  const selectedWeekRef = useRef(null)
  const scrolledRef = useRef(false)

  const flash = (message, severity = 'error') => setSnack({ message, severity })

  const selectWeek = (weekNumber) => {
    sessionStorage.setItem(weekStorageKey, String(weekNumber))
    setSelectedWeek(weekNumber)
  }

  const readyWeeks = plan?.generation_status === 'ready' ? (plan.weeks ?? []) : []
  const effectiveWeek = selectedWeek ?? (readyWeeks.length ? currentWeekNumber(readyWeeks) : null)

  const reloadPlan = useCallback(async () => {
    const p = await getPlan(planId)
    setPlan(p)
    return p
  }, [planId])

  // ── Chargement initial ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    scrolledRef.current = false
    getPlan(planId)
      .then((p) => { if (!cancelled) { setPlan(p); setLoading(false) } })
      .catch((e) => { if (!cancelled) { setLoadError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [planId])

  // ── Garde-fou : semaine restaurée absente du plan chargé (autre plan, régén) ──
  useEffect(() => {
    if (selectedWeek == null || !readyWeeks.length) return
    if (!readyWeeks.some((w) => w.week_number === selectedWeek)) {
      sessionStorage.removeItem(weekStorageKey)
      setSelectedWeek(null)
    }
  }, [selectedWeek, readyWeeks, weekStorageKey])

  // ── Suivi de génération tant que le plan génère ──────────────────────────────
  useEffect(() => {
    if (!plan || plan.generation_status !== 'generating') return
    const unsub = subscribeToPlan(planId, async () => {
      setRegenBusy(false)
      await reloadPlan()
    })
    return unsub
  }, [plan?.generation_status, planId, reloadPlan]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filet anti-blocage : si ça génère depuis plus de 6 min, bascule en erreur ──
  const isGenerating = regenBusy || plan?.generation_status === 'generating'
  useEffect(() => {
    if (!isGenerating) { setGenTimedOut(false); return }
    const t = setTimeout(() => setGenTimedOut(true), 6 * 60 * 1000)
    return () => clearTimeout(t)
  }, [isGenerating])

  // ── Chargement des séances de la semaine sélectionnée ─────────────────────────
  const reloadSessions = useCallback(async () => {
    const week = plan?.weeks?.find((w) => w.week_number === effectiveWeek)
    if (!week) return
    const data = await getWeekSessions(week.id)
    setSessions(data)
  }, [plan, effectiveWeek])

  useEffect(() => {
    if (effectiveWeek == null || !plan?.weeks?.length) return
    setSessions(null)
    reloadSessions().catch((e) => console.error('[PlanDashboard]', e.message))
  }, [effectiveWeek, plan, reloadSessions])

  // ── Scroll auto vers la semaine courante (une fois) ───────────────────────────
  useEffect(() => {
    if (scrolledRef.current || !selectedWeekRef.current) return
    selectedWeekRef.current.scrollIntoView({ inline: 'center', block: 'nearest' })
    scrolledRef.current = true
  }, [effectiveWeek])

  // ── Actions du header ─────────────────────────────────────────────────────────
  const readOnly = plan?.status !== 'active'
  useEffect(() => {
    if (!plan || plan.generation_status !== 'ready') { setHeaderActions([]); return }
    const actions = []
    if (!readOnly) {
      actions.push({ label: 'Régénérer les semaines restantes', icon: <Autorenew fontSize="small" />, onClick: () => setConfirmRegen(true) })
      actions.push({ label: 'Archiver ce plan', icon: <Inventory2Outlined fontSize="small" />, onClick: () => setConfirmArchive(true) })
    }
    actions.push({ label: 'Mes anciens plans', icon: <History fontSize="small" />, onClick: () => navigate('/training?view=history') })
    setHeaderActions(actions)
    return () => setHeaderActions([])
  }, [plan, readOnly, navigate, setHeaderActions])

  // ── Handlers séance ───────────────────────────────────────────────────────────
  const handleSkip = async (session) => {
    setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, status: 'skipped' } : s))
    try {
      await skipSession(session.id)
    } catch (e) {
      setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, status: 'planned' } : s))
      flash(e.message)
      return
    }
    setSkipDialog(session)
  }

  const handleCancelSkip = async () => {
    const s = skipDialog
    setSkipDialog(null)
    setSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, status: 'planned' } : x))
    try { await unskipSession(s.id) } catch (e) { flash(e.message) }
  }

  const handleAdapt = async () => {
    const s = skipDialog
    setAdapting(true)
    try {
      const { sessions: adapted } = await adaptSessions(s.id)
      await reloadSessions()
      const n = adapted?.length ?? 0
      flash(n > 0 ? `${n} séance${n > 1 ? 's' : ''} adaptée${n > 1 ? 's' : ''}` : 'Aucune séance à adapter', 'success')
    } catch (e) {
      flash(e.message)
    } finally {
      setAdapting(false)
      setSkipDialog(null)
    }
  }

  const handleOpen = (session) =>
    navigate(`/training/plan/${planId}/session/${session.id}`)

  // ── Handlers plan ─────────────────────────────────────────────────────────────
  const doRegen = async () => {
    setConfirmRegen(false)
    setRegenBusy(true)
    try {
      await regeneratePlan(planId)
      await reloadPlan()
    } catch (e) {
      setRegenBusy(false)
      flash(e.message)
    }
  }

  const doArchive = async () => {
    setConfirmArchive(false)
    try { await archivePlan(planId); navigate('/training') } catch (e) { flash(e.message) }
  }

  const doRetry = async () => {
    setRetrying(true)
    try {
      const payload = {
        race: {
          name: plan.race_name,
          date: plan.race_date,
          distance_m: plan.race_distance_m,
          elevation_m: plan.race_elevation_m ?? undefined,
        },
        fitness_snapshot: plan.fitness_snapshot,
        goal_time_sec: plan.goal_time_sec ?? undefined,
        previous_races: plan.previous_races ?? undefined,
        notes: plan.notes ?? undefined,
      }
      await deletePlan(planId)
      const { plan_id } = await generatePlan(payload)
      navigate(`/training/plan/${plan_id}`, { replace: true })
    } catch (e) {
      setRetrying(false)
      flash(e.message)
    }
  }

  const doDeleteErrored = async () => {
    try { await deletePlan(planId); navigate('/training') } catch (e) { flash(e.message) }
  }

  // ── États de rendu ────────────────────────────────────────────────────────────
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

  const generating = regenBusy || plan.generation_status === 'generating'
  if (generating && !genTimedOut) {
    const isRegen = regenBusy
    return (
      <Box sx={{
        height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pt: `${HEADER_HEIGHT}px`, px: 3, gap: 3, textAlign: 'center',
      }}>
        <CircularProgress size={40} thickness={3} />
        <Box>
          <Typography variant="body1" fontWeight={600} gutterBottom>
            {isRegen ? 'Régénération du plan en cours…' : 'Génération de ton plan en cours…'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
            {isRegen
              ? 'Les séances restantes sont recalibrées selon ta situation actuelle. Tu peux fermer et revenir, ça continue en arrière-plan.'
              : 'Ton plan est construit à partir de tes données Coros. Tu peux fermer et revenir, ça continue en arrière-plan.'}
          </Typography>
        </Box>
      </Box>
    )
  }

  if (plan.generation_status === 'error' || (generating && genTimedOut)) {
    const timedOut = generating && genTimedOut
    return (
      <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
        <Box sx={{ maxWidth: 520, mx: 'auto', px: 2, pt: 3, textAlign: 'center' }}>
          <ErrorOutlined sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>
            {timedOut ? 'Génération trop longue' : 'Génération échouée'}
          </Typography>
          <Alert severity="error" sx={{ textAlign: 'left', mb: 3 }}>
            {timedOut
              ? 'La génération dépasse le délai attendu (plus de 6 minutes). Réessaie ou supprime ce plan.'
              : (plan.generation_error ?? 'Une erreur est survenue lors de la génération du plan.')}
          </Alert>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button fullWidth color="inherit" startIcon={<DeleteOutlined />} onClick={doDeleteErrored} disabled={retrying}>
              Supprimer
            </Button>
            <Button fullWidth variant="contained" startIcon={<Autorenew />} onClick={doRetry} disabled={retrying}>
              {retrying ? <CircularProgress size={18} color="inherit" /> : 'Réessayer'}
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const weeks = plan.weeks
  const totalWeeks = weeks.length
  const currentWeek = currentWeekNumber(weeks)
  const effWeekObj = weeks.find((w) => w.week_number === effectiveWeek)
  const nextWeekObj = weeks.find((w) => w.week_number === effectiveWeek + 1)
  const isCurrentWeek = effectiveWeek === currentWeek
  const maxKm = weeks.reduce((m, w) => Math.max(m, w.target_km ?? 0), 0)
  const days = daysUntil(plan.race_date)

  // Km réalisés de la semaine sélectionnée : séances faites hors renfo, laps réels
  // si synchronisés, sinon fallback sur l'agrégat prévu.
  const doneMeters = (sessions ?? []).reduce((sum, s) => {
    if (s.type === 'renfo' || s.status !== 'done') return sum
    const laps = s.actual_laps
    if (Array.isArray(laps) && laps.length) {
      return sum + laps.reduce((a, l) => a + (l.distance_m ?? 0), 0)
    }
    return sum + (s.agg_distance_m ?? 0)
  }, 0)
  const targetKm = effWeekObj?.target_km
  const doneKmLabel = doneMeters ? formatKm(doneMeters) : '0'
  const donePct = targetKm ? Math.min(100, (doneMeters / 1000 / targetKm) * 100) : 0

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', pb: 6 }}>

        {/* En-tête plan */}
        <Box sx={{ ...glassSx, borderRadius: '20px', p: 2.25, mx: 2, mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {readOnly ? (
              <Chip
                label={PLAN_STATUS_LABEL[plan.status]?.toUpperCase() ?? plan.status}
                size="small"
                sx={{ height: 22, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em' }}
              />
            ) : (
              <Chip
                icon={<EmojiEvents sx={{ fontSize: '13px !important' }} />}
                label="PLAN ACTIF"
                size="small"
                sx={{
                  height: 22, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em',
                  color: 'primary.main', bgcolor: ZONE_STYLE.A.bg,
                  border: '1px solid', borderColor: 'primary.main',
                  '& .MuiChip-icon': { color: 'primary.main' },
                }}
              />
            )}
            <Typography variant="caption" color="text.disabled">
              Semaine {effectiveWeek} / {totalWeeks}
            </Typography>
          </Box>

          <Typography variant="h6" fontWeight={750} sx={{ mt: 1.25, letterSpacing: '-0.02em' }}>
            {plan.race_name}
          </Typography>

          <Box sx={{ display: 'flex', gap: 2.5, mt: 1.5, flexWrap: 'wrap' }}>
            {days != null && days >= 0 && (
              <Metric value={`J−${days}`} label="avant course" />
            )}
            {plan.goal_time_sec != null && (
              <Metric value={formatGoalTime(plan.goal_time_sec)} label="objectif" />
            )}
            {targetKm != null && (
              <Metric
                value={`${sessions === null ? '…' : doneKmLabel} / ${Math.round(targetKm)} km`}
                label={isCurrentWeek ? 'cette semaine' : `semaine S${effectiveWeek}`}
              />
            )}
          </Box>

          {targetKm != null && (
            <Box sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: 2, bgcolor: 'primary.main', width: `${donePct}%`, transition: 'width .3s' }} />
            </Box>
          )}
        </Box>

        {/* Bande de semaines */}
        <SectionLabel>Semaines</SectionLabel>
        <Box sx={{
          display: 'flex', gap: 1, overflowX: 'auto', px: 2, py: 1.5,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {weeks.map((w) => {
            const sel = w.week_number === effectiveWeek
            const blk = BLOCK_STYLE[w.block] ?? BLOCK_STYLE.construction
            const h = maxKm ? Math.round((w.target_km ?? 0) / maxKm * 100) : 0
            return (
              <Box
                key={w.id}
                ref={sel ? selectedWeekRef : null}
                onClick={() => selectWeek(w.week_number)}
                sx={{
                  flex: '0 0 58px', borderRadius: '14px', px: 1, py: 1,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 0.75, transition: 'all .15s',
                  bgcolor: sel ? 'background.paper' : 'transparent',
                  border: '1px solid', borderColor: sel ? 'primary.main' : 'divider',
                  transform: sel ? 'translateY(-2px)' : 'none',
                }}
              >
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: sel ? 'text.primary' : 'text.secondary' }}>
                  S{w.week_number}
                </Typography>
                <Box sx={{ width: '100%', height: 34, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Box sx={{ width: 16, height: `${Math.max(h, 6)}%`, borderRadius: '5px 5px 2px 2px', bgcolor: blk.main, opacity: 0.85 }} />
                </Box>
                <Typography sx={{ fontSize: '0.56rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
                  {w.target_km ? `${Math.round(w.target_km)} km` : ''}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Légende des blocs */}
        <Box sx={{ display: 'flex', gap: 2, px: 2.5, mt: 0.5 }}>
          {Object.entries(BLOCK_LABEL).map(([key, label]) => (
            <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '3px', bgcolor: BLOCK_STYLE[key].main }} />
              <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>{label}</Typography>
            </Box>
          ))}
        </Box>

        {/* Séances de la semaine, groupées par zone */}
        <Box sx={{ px: 2, mt: 2.5 }}>
          {effWeekObj && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 0.5, mb: 1.5 }}>
              {formatWeekRange(effWeekObj, nextWeekObj)}
            </Typography>
          )}
          {sessions === null && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress size={22} />
            </Box>
          )}
          {sessions !== null && sessions.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              Aucune séance pour cette semaine.
            </Typography>
          )}
          {sessions !== null && groupSessionsByZone(sessions).map((group) => (
            <ZoneGroup
              key={group.zone}
              group={group}
              readOnly={readOnly}
              onSkip={handleSkip}
              onOpen={handleOpen}
            />
          ))}
        </Box>

        {!readOnly && (sessions?.length ?? 0) > 0 && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textAlign: 'center', mt: 1, px: 2 }}>
            Tape une séance pour l'ouvrir · glisse à droite pour la sauter
          </Typography>
        )}
      </Box>

      {/* Dialog adaptation */}
      <Dialog
        open={Boolean(skipDialog)}
        onClose={() => !adapting && handleCancelSkip()}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Adapter les séances suivantes ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {adapting
              ? 'Adaptation en cours… tu peux patienter ici.'
              : `« ${cleanText(skipDialog?.title)} » est marquée comme sautée. Veux-tu recalibrer les prochaines séances en conséquence ?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelSkip} disabled={adapting} color="inherit">Annuler</Button>
          <Button onClick={handleAdapt} disabled={adapting} variant="contained">
            {adapting ? <CircularProgress size={18} color="inherit" /> : 'Adapter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog régénération */}
      <ConfirmDialog
        open={confirmRegen}
        onClose={() => setConfirmRegen(false)}
        onConfirm={doRegen}
        title="Régénérer les semaines restantes ?"
        text="Les séances à venir (semaine courante incluse) seront reconstruites selon ton historique récent. Les séances passées sont conservées."
        confirmLabel="Régénérer"
      />

      {/* Dialog archivage */}
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        onConfirm={doArchive}
        title="Archiver ce plan ?"
        text="Le plan passera en lecture seule et ne sera plus modifiable. Tu pourras toujours le consulter dans tes anciens plans."
        confirmLabel="Archiver"
      />

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

const Metric = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>{label}</Typography>
  </Box>
)

/** Groupe d'une zone : en-tête (pastille + plage de jours + compteur) et cartes
 *  reliées par un filet vertical coloré. */
const ZoneGroup = ({ group, readOnly, onSkip, onOpen }) => {
  const { zone, sessions, done, total } = group
  const z = ZONE_STYLE[zone] ?? ZONE_STYLE.A
  const sub = ZONE_SUBLABEL[zone]

  return (
    <Box sx={{ mb: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, px: 0.5, pb: 1 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.85, color: z.main, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.03em' }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3.5px', bgcolor: z.main }} />
          {ZONE_LABEL[zone]}{sub ? ` · ${sub}` : ''}
        </Box>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontWeight: 600 }}>
          {ZONE_DAYS[zone]}
        </Typography>
        <Typography sx={{ ml: 'auto', fontSize: '0.7rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}>
          {done} / {total}
        </Typography>
      </Box>

      <Box sx={{ position: 'relative', pl: '14px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ position: 'absolute', left: '4px', top: '6px', bottom: '6px', width: '3px', borderRadius: '2px', bgcolor: z.main, opacity: 0.55 }} />
        {sessions.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            canSkip={!readOnly && s.status !== 'done'}
            onSkip={onSkip}
            onOpen={onOpen}
          />
        ))}
      </Box>
    </Box>
  )
}

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, px: 2.5 }}
  >
    {children}
  </Typography>
)

const ConfirmDialog = ({ open, onClose, onConfirm, title, text, confirmLabel }) => (
  <Dialog
    open={open}
    onClose={onClose}
    slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
  >
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    <DialogContent>
      <DialogContentText>{text}</DialogContentText>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} color="inherit">Annuler</Button>
      <Button onClick={onConfirm} variant="contained">{confirmLabel}</Button>
    </DialogActions>
  </Dialog>
)

export default PlanDashboard
