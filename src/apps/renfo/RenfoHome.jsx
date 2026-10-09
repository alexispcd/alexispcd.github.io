import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from '@mui/material'
import SettingsOutlined from '@mui/icons-material/SettingsOutlined'
import FitnessCenter from '@mui/icons-material/FitnessCenter'
import Add from '@mui/icons-material/Add'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import { useAppCtx } from '../../lib/context'
import { useOnline } from '../../hooks/useOnline'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import {
  createFreeSession, getActiveCycle, getBands, getCycleSessions, getCycleStatus, getFreeSessions,
  getProfile, startCycle,
} from '../../lib/renfo'
import { PHASE_LABELS, WEEK_PHASES } from '../../../supabase/functions/_shared/strength/rules.ts'
import { addDaysISO, currentCycleWeek, formatWeekRange, isCycleOver, mondayOf, todayISO } from './dates'
import { generationErrorMessage } from './errors'
import SectionLabel from './SectionLabel'
import SessionCard from './home/SessionCard'
import FreeSessionDialog from './home/FreeSessionDialog'

const CARD_RADIUS = '28px'
// Interrogation de l'état du cycle pendant sa génération (une semaine par appel modèle).
const POLL_MS = 4000

const loadHome = async () => {
  const [profile, bands, cycle] = await Promise.all([getProfile(), getBands(), getActiveCycle()])
  const thisWeek = mondayOf(todayISO())
  if (!cycle) {
    const free = profile ? await getFreeSessions(thisWeek, thisWeek) : []
    return { profile, bands, cycle: null, sessions: [], free }
  }
  // Séances libres des 4 semaines du cycle, et de la semaine en cours si le cycle est fini.
  const lastWeek = addDaysISO(cycle.start_date, 21)
  const [sessions, free] = await Promise.all([
    getCycleSessions(cycle.id),
    getFreeSessions(cycle.start_date, thisWeek > lastWeek ? thisWeek : lastWeek),
  ])
  return { profile, bands, cycle, sessions, free }
}

/** Accueil Renfo : état du profil et du cycle, séances de la semaine, séance libre. */
const RenfoHome = () => {
  const navigate = useAppNavigate()
  const online = useOnline()
  const { setHeaderActions } = useAppCtx()
  const [state, setState] = useState({ status: 'loading' })
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [starting, setStarting] = useState(false)
  const [freeOpen, setFreeOpen] = useState(false)
  const [snack, setSnack] = useState(null)

  const reload = useCallback(() => loadHome().then(
    (res) => setState({ status: 'ready', ...res }),
    (err) => {
      console.error('[renfo home]', err)
      setState((s) => (s.status === 'ready' ? s : { status: 'error' }))
    },
  ), [])

  useEffect(() => {
    let cancelled = false
    loadHome().then(
      (res) => { if (!cancelled) setState({ status: 'ready', ...res }) },
      (err) => {
        console.error('[renfo home]', err)
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setHeaderActions([
      {
        label: 'Réglages',
        icon: <SettingsOutlined fontSize="small" />,
        onClick: () => navigate('/renfo/settings', { direction: 'forward' }),
      },
    ])
    return () => setHeaderActions([])
  }, [navigate, setHeaderActions])

  // Suivi de la génération : on relit l'état du cycle et on recharge l'accueil dès
  // qu'une semaine de plus est prête ou que la génération se termine.
  const cycle = state.cycle
  const generating = cycle?.generation_status === 'generating'
  useEffect(() => {
    if (!generating || !online) return undefined
    const id = setInterval(() => {
      getCycleStatus(cycle.id).then((s) => {
        if (s.generation_status !== cycle.generation_status || s.generated_weeks !== cycle.generated_weeks) reload()
      }).catch((e) => console.error('[renfo home]', e))
    }, POLL_MS)
    return () => clearInterval(id)
  }, [generating, online, cycle?.id, cycle?.generation_status, cycle?.generated_weeks, reload])

  const launch = async () => {
    setStarting(true)
    try {
      await startCycle()
      setSelectedWeek(null)
      await reload()
    } catch (e) {
      setSnack({ severity: 'error', text: generationErrorMessage(e) })
      // Un 409 peut venir d'un état déjà avancé côté serveur : on se resynchronise.
      if (e.status === 409) await reload()
    } finally {
      setStarting(false)
    }
  }

  const createFree = async (kind) => {
    try {
      const { session } = await createFreeSession(kind)
      setFreeOpen(false)
      navigate(`/renfo/session/${session.id}`, { direction: 'forward' })
    } catch (e) {
      throw new Error(generationErrorMessage(e), { cause: e })
    }
  }

  const openSession = (s) => navigate(`/renfo/session/${s.id}`, { direction: 'forward' })

  if (state.status === 'loading') {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pt: `${HEADER_HEIGHT}px` }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  if (state.status === 'error') {
    return (
      <Box sx={{ px: 2, pt: `${HEADER_HEIGHT + 16}px` }}>
        <Alert severity="error">
          Impossible de charger Renfo.{!online && ' Tu es hors ligne et ces données ne sont pas encore en cache.'}
        </Alert>
      </Box>
    )
  }

  const { profile, bands, sessions, free } = state
  const today = todayISO()
  const thisWeek = mondayOf(today)
  const offlineNote = !online && (
    <Alert severity="info" sx={{ mt: 2 }}>Hors ligne : consultation et player disponibles, la génération demande le réseau.</Alert>
  )
  const primaryBtn = { height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 700, boxShadow: 'none' }

  // ── Pas de profil ──
  if (!profile) {
    return (
      <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>
          {offlineNote}
          <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 3, mt: 2, textAlign: 'center' }}>
            <FitnessCenter sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" fontWeight={700}>Règle ton matériel et ta fréquence pour commencer</Typography>
            <Button variant="contained" fullWidth sx={{ ...primaryBtn, mt: 2.5 }} onClick={() => navigate('/renfo/settings', { direction: 'forward' })}>
              Ouvrir les réglages
            </Button>
          </Box>
        </Box>
      </Box>
    )
  }

  const generatedWeeks = cycle?.generated_weeks ?? 0
  const cycleCurrentWeek = cycle ? currentCycleWeek(cycle.start_date, today) : 1
  // Semaine affichée : choisie, sinon la semaine en cours (bornée aux semaines prêtes).
  const shownWeek = cycle
    ? Math.min(selectedWeek ?? cycleCurrentWeek, Math.max(1, cycle.generation_status === 'ready' ? 4 : generatedWeeks))
    : null
  const shownWeekStart = cycle ? addDaysISO(cycle.start_date, 7 * (shownWeek - 1)) : thisWeek
  const weekSessions = sessions.filter((s) => s.week_index === shownWeek)
  const weekFree = free.filter((s) => s.week_start === shownWeekStart)
  const over = cycle && cycle.generation_status === 'ready' && isCycleOver(cycle.start_date, today)
  const phase = shownWeek ? WEEK_PHASES[shownWeek - 1]?.phase : null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>
        {offlineNote}

        {/* ── Aucun cycle ── */}
        {!cycle && (
          <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 3, mt: 2, textAlign: 'center' }}>
            <FitnessCenter sx={{ fontSize: 38, color: 'primary.main', mb: 1 }} />
            <Typography variant="body1" fontWeight={700}>Prêt pour ton premier cycle</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              4 semaines progressives, construites avec ton matériel.
            </Typography>
            <Button variant="contained" fullWidth sx={{ ...primaryBtn, mt: 2.5 }} disabled={starting || !online} onClick={launch}>
              {starting ? <CircularProgress size={18} color="inherit" /> : 'Lancer mon premier cycle'}
            </Button>
          </Box>
        )}

        {/* ── Génération en cours ── */}
        {generating && (
          <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 2.5, mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <CircularProgress size={26} />
            <Box>
              <Typography variant="body1" fontWeight={700}>
                Préparation du cycle, semaine {Math.min(generatedWeeks + 1, 4)} sur 4
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tu peux quitter l'écran, la préparation continue.
              </Typography>
            </Box>
          </Box>
        )}

        {/* ── Erreur de génération ── */}
        {cycle?.generation_status === 'error' && (
          <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 2.5, mt: 2 }}>
            <Typography variant="body1" fontWeight={700}>La préparation du cycle s'est interrompue</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {generatedWeeks > 0 ? `${generatedWeeks} semaine${generatedWeeks > 1 ? 's' : ''} sur 4 prête${generatedWeeks > 1 ? 's' : ''}. ` : ''}
              Relance-la, elle reprendra là où elle s'est arrêtée.
            </Typography>
            <Button variant="contained" fullWidth sx={{ ...primaryBtn, mt: 2 }} disabled={starting || !online} onClick={launch}>
              {starting ? <CircularProgress size={18} color="inherit" /> : 'Reprendre la génération'}
            </Button>
          </Box>
        )}

        {/* ── Cycle terminé ── */}
        {over && (
          <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 2.5, mt: 2 }}>
            <Typography variant="body1" fontWeight={700}>Cycle terminé</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Le suivant fera tourner les exercices principaux.
            </Typography>
            <Button variant="contained" fullWidth sx={{ ...primaryBtn, mt: 2 }} disabled={starting || !online} onClick={launch}>
              {starting ? <CircularProgress size={18} color="inherit" /> : 'Lancer le cycle suivant'}
            </Button>
          </Box>
        )}

        {/* ── Semaines du cycle ── */}
        {cycle && generatedWeeks > 0 && (
          <>
            <Box sx={{ mt: 3, px: 0.5 }}>
              <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic', fontSize: '1.6rem', lineHeight: 1.1 }}>
                Cycle {cycle.number}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Semaine {shownWeek} sur 4 · {PHASE_LABELS[phase] ?? ''} · {formatWeekRange(shownWeekStart)}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
              {[1, 2, 3, 4].map((w) => {
                const ready = cycle.generation_status === 'ready' || w <= generatedWeeks
                const on = w === shownWeek
                return (
                  <Box
                    key={w}
                    component="button"
                    type="button"
                    disabled={!ready}
                    onClick={() => setSelectedWeek(w)}
                    sx={{
                      flex: 1, py: 1, borderRadius: '12px', font: 'inherit', fontWeight: 700, fontSize: '0.8rem',
                      border: '1px solid', cursor: ready ? 'pointer' : 'default',
                      borderColor: on ? 'primary.main' : 'divider',
                      bgcolor: on ? 'primary.main' : 'transparent',
                      color: on ? 'primary.contrastText' : ready ? 'text.primary' : 'text.disabled',
                      position: 'relative',
                    }}
                  >
                    S{w}
                    {w === cycleCurrentWeek && !over && (
                      <Box sx={{ position: 'absolute', top: 4, right: 6, width: 5, height: 5, borderRadius: '50%', bgcolor: on ? 'primary.contrastText' : 'primary.main' }} />
                    )}
                  </Box>
                )
              })}
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 2 }}>
              {weekSessions.map((s) => <SessionCard key={s.id} session={s} bands={bands} onOpen={() => openSession(s)} />)}
              {weekFree.map((s) => <SessionCard key={s.id} session={s} bands={bands} free onOpen={() => openSession(s)} />)}
            </Box>
          </>
        )}

        {/* ── Séances libres hors cycle (aucun cycle, ou semaine après la fin du cycle) ── */}
        {(!cycle || (over && thisWeek !== shownWeekStart)) && free.filter((s) => s.week_start === thisWeek).length > 0 && (
          <>
            <SectionLabel>Cette semaine</SectionLabel>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {free.filter((s) => s.week_start === thisWeek).map((s) => (
                <SessionCard key={s.id} session={s} bands={bands} free onOpen={() => openSession(s)} />
              ))}
            </Box>
          </>
        )}

        <Button
          variant="outlined"
          fullWidth
          startIcon={<Add />}
          sx={{ ...primaryBtn, mt: 3 }}
          onClick={() => setFreeOpen(true)}
        >
          Séance libre
        </Button>
      </Box>

      <FreeSessionDialog
        open={freeOpen}
        online={online}
        onClose={() => setFreeOpen(false)}
        onCreate={createFree}
      />

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={5000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default RenfoHome
