import { useState, useEffect, useEffectEvent, useCallback, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { texteErreur } from '../../../lib/reseau'
import { useMessage } from '../../../ui/useMessage'
import { Box, Typography, Chip, Button, Alert } from '@mui/material'
import EmojiEvents from '@mui/icons-material/EmojiEvents'
import Autorenew from '@mui/icons-material/Autorenew'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { useAppCtx } from '../../../lib/context'
import { cardSx } from '../../../styles/glass'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import BarreAttente from '../../../ui/BarreAttente'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import {
  getPlan, getWeekSessions, subscribeToPlan,
  skipSession, adaptSessions,
  regeneratePlan, archivePlan, deletePlan, generatePlan, countUpcomingOnWatch,
} from '../../../lib/training'
import {
  BLOCK_STYLE, ZONE_STYLE, BLOCK_LABEL, PLAN_STATUS_LABEL,
  ZONE_LABEL, ZONE_SUBLABEL, ZONE_DAYS, intensityOf,
  formatGoalTime, formatKm, daysUntil, currentWeekNumber, formatWeekRange,
  groupSessionsByZone, cleanText, onWatchWarning,
} from '../constants'
import SessionRow from './SessionRow'
import CorosPushDialog from '../session/CorosPushDialog'
import SkipSheet from '../session/SkipSheet'
import { DURATION, transition } from '../../../styles/motion'

const SAUT_ECHEC = 'La séance n\'a pas pu être sautée. Réessaie.'
const ADAPTATION_ECHEC = 'L\'adaptation n\'a pas abouti. Réessaie.'

// Carte d'attente en tête de page : l'écart du haut s'ouvre et se replie avec elle.
const CARTE_ATTENTE_SX = { mx: 2, '& .MuiCollapse-wrapperInner': { pt: 1.5 } }

const nombreAdaptees = (n) =>
  (n > 0 ? `${n} séance${n > 1 ? 's' : ''} adaptée${n > 1 ? 's' : ''}` : 'Aucune séance à adapter')

const PlanDashboard = () => {
  const { planId } = useParams()
  const navigate = useAppNavigate()
  const navigateSansTransition = useNavigate()
  const location = useLocation()
  const { setHeaderActions } = useAppCtx()
  const { afficher } = useMessage()

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
  const [sessionsLoading, setSessionsLoading] = useState(false)

  // Feuille « Sauter » : la séance visée reste posée pendant la fermeture de la feuille.
  const [sautCible, setSautCible] = useState(null)
  const [sautOuvert, setSautOuvert] = useState(false)
  const [regenOuverte, setRegenOuverte] = useState(false)
  const [regenOnWatch, setRegenOnWatch] = useState(0) // séances envoyées qui vont disparaître
  const [pushDialog, setPushDialog] = useState(null)
  const [archiveOuverte, setArchiveOuverte] = useState(false)
  const [genTimedOut, setGenTimedOut] = useState(false)
  const [adaptTitre, setAdaptTitre] = useState('')

  const attente = useFinAttente(loading)
  const attenteSeances = useFinAttente(sessions === null)

  const saut = useAction({ attente: 'Saut de la séance', duree: DUREES.actionCourte, echec: SAUT_ECHEC })
  const adaptation = useAction({
    attente: 'Adaptation de tes séances',
    duree: DUREES.adaptation,
    succes: nombreAdaptees,
    echec: (e) => (e?.etape === 'saut' ? SAUT_ECHEC : ADAPTATION_ECHEC),
  })
  const archivage = useAction({
    attente: 'Archivage du plan', duree: DUREES.actionCourte,
    echec: 'Le plan n\'a pas pu être archivé. Réessaie.',
  })
  const relance = useAction({
    attente: 'Génération de ton plan', duree: DUREES.actionCourte,
    echec: 'La génération n\'a pas pu redémarrer. Réessaie.',
  })

  const selectedWeekRef = useRef(null)
  const scrolledRef = useRef(false)

  const echec = (e, phrase) => afficher(texteErreur(e, phrase))

  const selectWeek = (weekNumber) => {
    sessionStorage.setItem(weekStorageKey, String(weekNumber))
    setSelectedWeek(weekNumber)
  }

  const readyWeeks = useMemo(
    () => (plan?.generation_status === 'ready' ? (plan.weeks ?? []) : []),
    [plan],
  )

  // Garde-fou : semaine restaurée absente du plan chargé (autre plan, régén). La
  // sélection est remise à null au rendu ; l'effet plus bas nettoie sessionStorage.
  if (selectedWeek != null && readyWeeks.length && !readyWeeks.some((w) => w.week_number === selectedWeek)) {
    setSelectedWeek(null)
  }

  const effectiveWeek = selectedWeek ?? (readyWeeks.length ? currentWeekNumber(readyWeeks) : null)

  const reloadPlan = useCallback(async () => {
    const p = await getPlan(planId)
    setPlan(p)
    return p
  }, [planId])

  // ── Chargement initial ──────────────────────────────────────────────────────
  // Changement de plan : état de chargement remis au rendu, l'effet ne fait que charger.
  const [prevPlanId, setPrevPlanId] = useState(planId)
  if (planId !== prevPlanId) {
    setPrevPlanId(planId)
    setLoading(true)
    setLoadError(null)
  }

  useEffect(() => {
    let cancelled = false
    scrolledRef.current = false
    getPlan(planId)
      .then((p) => { if (!cancelled) { setPlan(p); setLoading(false) } })
      .catch((e) => {
        console.error('[PlanDashboard] chargement :', e)
        if (!cancelled) { setLoadError('Les données n\'ont pas pu être chargées.'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [planId])

  // ── Garde-fou (suite) : retire de sessionStorage une semaine absente du plan ──
  useEffect(() => {
    const stored = sessionStorage.getItem(weekStorageKey)
    if (stored == null || !readyWeeks.length) return
    if (!readyWeeks.some((w) => String(w.week_number) === stored)) sessionStorage.removeItem(weekStorageKey)
  }, [readyWeeks, weekStorageKey])

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
  // Fin de génération : le délai dépassé est oublié dès le rendu.
  const [prevGenerating, setPrevGenerating] = useState(isGenerating)
  if (isGenerating !== prevGenerating) {
    setPrevGenerating(isGenerating)
    if (!isGenerating) setGenTimedOut(false)
  }
  useEffect(() => {
    if (!isGenerating) return
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

  // Au changement de semaine on ne vide PAS la liste (setSessions(null)) : on garde
  // l'ancienne rendue en fondu pour préserver la hauteur et donc la position de scroll.
  // L'indicateur de chargement passe à true au rendu quand la semaine ou le plan
  // change ; l'effet lance le chargement et le repasse à false.
  const [prevSessionsSource, setPrevSessionsSource] = useState({ effectiveWeek, plan })
  if (prevSessionsSource.effectiveWeek !== effectiveWeek || prevSessionsSource.plan !== plan) {
    setPrevSessionsSource({ effectiveWeek, plan })
    if (effectiveWeek != null && plan?.weeks?.length) setSessionsLoading(true)
  }

  useEffect(() => {
    if (effectiveWeek == null || !plan?.weeks?.length) return
    // Même chargement que reloadSessions, écrit en chaîne de promesses : tous les
    // setState partent des callbacks, jamais du corps de l'effet.
    const week = plan.weeks.find((w) => w.week_number === effectiveWeek)
    Promise.resolve(week ? getWeekSessions(week.id) : undefined)
      .then((data) => { if (week) setSessions(data) })
      .catch((e) => console.error('[PlanDashboard]', e.message))
      .finally(() => setSessionsLoading(false))
  }, [effectiveWeek, plan])

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
      actions.push({ label: 'Régénérer les semaines restantes', onClick: () => { setRegenOnWatch(0); setRegenOuverte(true) } })
      actions.push({ label: 'Archiver ce plan', onClick: () => setArchiveOuverte(true) })
    }
    actions.push({ label: 'Mes anciens plans', onClick: () => navigate('/training?view=history', { direction: 'forward' }) })
    actions.push({ label: 'Réglages', onClick: () => navigate('/training/settings', { direction: 'forward' }) })
    setHeaderActions(actions, plan.race_name)
    return () => setHeaderActions([])
  }, [plan, readOnly, navigate, setHeaderActions])

  // ── Séances déjà sur la montre qu'une régénération ferait disparaître ─────────
  // Même borne que regenerate-plan : semaines à partir de la courante incluse.
  useEffect(() => {
    if (!regenOuverte || !plan?.weeks?.length) return
    let cancelled = false
    countUpcomingOnWatch(planId, currentWeekNumber(plan.weeks))
      .then((n) => { if (!cancelled) setRegenOnWatch(n) })
      .catch((e) => console.error('[PlanDashboard]', e.message))
    return () => { cancelled = true }
  }, [regenOuverte, planId, plan])

  // ── Handlers séance ───────────────────────────────────────────────────────────
  // Rien n'est écrit avant le choix dans la feuille « Sauter ».
  const handleSkip = (session) => {
    setSautCible(session)
    setSautOuvert(true)
  }

  const marquerSautee = (id) =>
    setSessions((prev) => prev?.map((s) => (s.id === id ? { ...s, status: 'skipped' } : s)) ?? prev)

  // Rechargement à jour même depuis une adaptation lancée avant le chargement du plan.
  const reloadSessionsRef = useRef(reloadSessions)
  useEffect(() => { reloadSessionsRef.current = reloadSessions })

  // Adaptation après un saut ; sauterAvant : le saut n'est pas encore écrit (dashboard).
  // La séance reste sautée si l'adaptation échoue.
  const adapter = ({ sessionId, titre }, sauterAvant = false) => {
    setAdaptTitre(titre)
    return adaptation.lancer(async () => {
      if (sauterAvant) {
        try {
          await skipSession(sessionId)
        } catch (e) {
          if (e && typeof e === 'object') e.etape = 'saut'
          throw e
        }
        marquerSautee(sessionId)
      }
      const { sessions: adapted } = await adaptSessions(sessionId)
      try {
        await reloadSessionsRef.current()
      } catch (e) {
        console.error('[PlanDashboard] rechargement après adaptation :', e)
      }
      return adapted?.length ?? 0
    })
  }

  const sauterSansAdapter = async (session) => {
    const { ok } = await saut.lancer(() => skipSession(session.id))
    if (ok) marquerSautee(session.id)
  }

  // Arrivée depuis la page séance après « Sauter et adapter » : l'adaptation part une
  // seule fois (garde contre le double effet de StrictMode), puis le state est retiré
  // pour qu'un retour ne la relance pas. Lancée en chaîne de promesses (lint).
  const adaptationLancee = useRef(false)
  const demandeAdaptation = location.state?.adapter
  const lancerAdaptationDemandee = useEffectEvent((demande) => {
    navigateSansTransition(location.pathname, { replace: true, state: null })
    Promise.resolve().then(() => adapter(demande))
  })
  useEffect(() => {
    if (!demandeAdaptation || adaptationLancee.current) return
    adaptationLancee.current = true
    lancerAdaptationDemandee(demandeAdaptation)
  }, [demandeAdaptation])

  const handleOpen = (session) =>
    navigate(`/training/plan/${planId}/session/${session.id}`)

  // Swipe "Envoyer" : popup d'envoi vers la montre (séance pas encore envoyée).
  const handlePush = (session) => setPushDialog(session)

  const onPushed = (res) => {
    setPushDialog(null)
    afficher(res?.previous_copy?.upcoming
      ? "Séance envoyée. Supprime l'ancienne copie dans l'app Coros."
      : 'Séance envoyée sur ta montre')
    reloadSessions().catch((e) => echec(e, 'Les données n\'ont pas pu être rechargées. Réessaie.'))
  }

  // ── Handlers plan ─────────────────────────────────────────────────────────────
  const doRegen = async () => {
    setRegenBusy(true)
    try {
      await regeneratePlan(planId)
      await reloadPlan()
    } catch (e) {
      setRegenBusy(false)
      echec(e, 'La régénération n\'a pas pu démarrer. Réessaie.')
    }
  }


  const doArchive = async () => {
    const { ok } = await archivage.lancer(() => archivePlan(planId))
    if (ok) navigate('/training')
  }

  const doRetry = async () => {
    const { ok, valeur } = await relance.lancer(async () => {
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
      return plan_id
    })
    if (ok) navigate(`/training/plan/${valeur}`, { replace: true })
  }

  const doDeleteErrored = async () => {
    try { await deletePlan(planId); navigate('/training') } catch (e) { echec(e, 'Le plan n\'a pas pu être supprimé. Réessaie.') }
  }

  // ── États de rendu ────────────────────────────────────────────────────────────
  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
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
        {/* Attente sans fin tant que ça génère ; la vraie barre par semaines viendra en T3. */}
        <BarreAttente
          place="page"
          phrase={isRegen ? 'Régénération de ton plan' : 'Génération de ton plan'}
          duree={DUREES.generationPlan}
          visible
          sx={{ height: 'auto' }}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="corps-fort">
            {isRegen ? 'Régénération de ton plan' : 'Génération de ton plan'}
          </Typography>
          <Typography variant="secondaire" sx={{ color: 'muted', maxWidth: 320 }}>
            {isRegen
              ? 'Tu peux fermer l\'app, la régénération continue.'
              : 'Tu peux fermer l\'app, la génération continue.'}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button fullWidth color="inherit" startIcon={<DeleteOutlined />} onClick={doDeleteErrored} disabled={relance.barre.visible}>
              Supprimer
            </Button>
            {relance.barre.visible
              ? <BarreAttente place="barre" {...relance.barre} sx={{ flex: 1, minWidth: 0 }} />
              : (
                <Button fullWidth variant="contained" startIcon={<Autorenew />} onClick={doRetry}>
                  Réessayer
                </Button>
              )}
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
  // Kilométrage d'une semaine = somme des distances de ses séances (agg_distance_m),
  // aligné sur le total réel des séances affichées (pas la cible IA target_km).
  const weekKm = (w) => (w.agg_distance_m ?? 0) / 1000
  const maxKm = weeks.reduce((m, w) => Math.max(m, weekKm(w)), 0)
  const days = daysUntil(plan.race_date)

  // Km réalisés de la semaine sélectionnée : séances faites, laps réels
  // si synchronisés, sinon fallback sur l'agrégat prévu.
  const doneMeters = (sessions ?? []).reduce((sum, s) => {
    if (s.status !== 'done') return sum
    const laps = s.actual_laps
    if (Array.isArray(laps) && laps.length) {
      return sum + laps.reduce((a, l) => a + (l.distance_m ?? 0), 0)
    }
    return sum + (s.agg_distance_m ?? 0)
  }, 0)
  const targetKm = effWeekObj ? weekKm(effWeekObj) : null
  const doneKmLabel = doneMeters ? formatKm(doneMeters) : '0'
  const donePct = targetKm ? Math.min(100, (doneMeters / 1000 / targetKm) * 100) : 0

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'env(safe-area-inset-bottom, 0px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto' }}>

        {/* Cartes d'attente */}
        <BarreAttente place="carte" {...adaptation.barre} sx={CARTE_ATTENTE_SX}
          detail={`${adaptTitre} est sautée. Les séances des 10 prochains jours sont recalculées.`} />
        <BarreAttente place="carte" {...saut.barre} sx={CARTE_ATTENTE_SX} />
        <BarreAttente place="carte" {...archivage.barre} sx={CARTE_ATTENTE_SX} />

        {/* En-tête plan */}
        <Box sx={{ ...cardSx, borderRadius: '20px', p: 2.25, mx: 2, mt: 1.5 }}>
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
                  color: 'primary.main', bgcolor: 'chip',
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
                value={`${(sessionsLoading || sessions === null) ? '…' : doneKmLabel} / ${Math.round(targetKm)} km`}
                label={isCurrentWeek ? 'cette semaine' : `semaine S${effectiveWeek}`}
              />
            )}
          </Box>

          {targetKm != null && (
            <Box sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: 2, bgcolor: 'primary.main', width: `${(sessionsLoading || sessions === null) ? 0 : donePct}%`, transition: transition('width', DURATION.fill) }} />
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
            const h = maxKm ? Math.round(weekKm(w) / maxKm * 100) : 0
            return (
              <Box
                key={w.id}
                ref={sel ? selectedWeekRef : null}
                onClick={() => selectWeek(w.week_number)}
                sx={{
                  flex: '0 0 58px', borderRadius: '14px', px: 1, py: 1,
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 0.75,
                  transition: transition(['background-color', 'border-color', 'transform'], DURATION.fade),
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
                  {weekKm(w) ? `${Math.round(weekKm(w))} km` : ''}
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
          {attenteSeances.visible && (
            <Box sx={{ py: 5 }}>
              <BarreAttente place="section" duree={DUREES.chargementPage} {...attenteSeances} />
            </Box>
          )}
          {!attenteSeances.visible && sessions !== null && (
            <Box sx={{
              opacity: sessionsLoading ? 0.45 : 1,
              pointerEvents: sessionsLoading ? 'none' : 'auto',
              transition: 'opacity .15s',
            }}>
              {sessions.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  Aucune séance pour cette semaine.
                </Typography>
              )}
              {groupSessionsByZone(sessions).map((group) => (
                <ZoneGroup
                  key={group.zone}
                  group={group}
                  readOnly={readOnly}
                  onSkip={handleSkip}
                  onOpen={handleOpen}
                  onPush={handlePush}
                />
              ))}
            </Box>
          )}
        </Box>

        {!readOnly && (sessions?.length ?? 0) > 0 && (
          <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', textAlign: 'center', mt: 1, px: 2 }}>
            Tape une séance pour l'ouvrir · glisse à droite pour la sauter, à gauche pour l'envoyer
          </Typography>
        )}
      </Box>

      <SkipSheet
        session={sautCible}
        ouverte={sautOuvert}
        onFermer={() => setSautOuvert(false)}
        onAdapter={() => adapter({ sessionId: sautCible.id, titre: cleanText(sautCible.title) }, true)}
        onSansAdapter={() => sauterSansAdapter(sautCible)}
      />

      <FeuilleFlottante
        ouverte={regenOuverte}
        onFermer={() => setRegenOuverte(false)}
        titre={'Les semaines à venir seront reconstruites selon ton historique récent, semaine en cours comprise. Les séances passées sont gardées.'
          + (regenOnWatch > 0 ? ` ${onWatchWarning(regenOnWatch)}` : '')}
        lignes={[{ libelle: 'Régénérer les semaines restantes', onClick: doRegen }]}
        fermerLibelle="Annuler"
      />

      {/* Popup d'envoi vers la montre (swipe) */}
      <CorosPushDialog
        open={Boolean(pushDialog)}
        session={pushDialog}
        onClose={() => setPushDialog(null)}
        onDone={onPushed}
      />

      <FeuilleFlottante
        ouverte={archiveOuverte}
        onFermer={() => setArchiveOuverte(false)}
        titre={`${plan.race_name} passera en lecture seule et rejoindra tes anciens plans. Tu pourras créer un nouveau plan.`}
        lignes={[{ libelle: 'Archiver le plan', onClick: doArchive }]}
        fermerLibelle="Annuler"
      />
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
const ZoneGroup = ({ group, readOnly, onSkip, onOpen, onPush }) => {
  const { zone, sessions, done, total } = group
  // Rendu (couleur + sous libellé) dérivé de l'intensité de la séance de course
  // qui occupe la zone : après adaptation, une zone A peut porter une qualité.
  // ZONE_LABEL / ZONE_DAYS restent calés sur la zone (créneau de jours).
  const runSession = sessions[0]
  const key = runSession ? intensityOf(runSession.type) : zone
  const z = ZONE_STYLE[key] ?? ZONE_STYLE.A
  const sub = ZONE_SUBLABEL[key]

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
            canPush={!readOnly && (s.status === 'planned' || s.status === 'adapted')}
            onSkip={onSkip}
            onOpen={onOpen}
            onPush={onPush}
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

export default PlanDashboard
