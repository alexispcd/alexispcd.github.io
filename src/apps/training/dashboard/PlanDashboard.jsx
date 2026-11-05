import { useState, useEffect, useEffectEvent, useCallback, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { texteErreur } from '../../../lib/reseau'
import { useMessage } from '../../../ui/useMessage'
import { Box, Typography, Button, Alert } from '@mui/material'
import Autorenew from '@mui/icons-material/Autorenew'
import ErrorOutlined from '@mui/icons-material/ErrorOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { useAppCtx } from '../../../lib/context'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import BarreAttente from '../../../ui/BarreAttente'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import Page from '../../../ui/Page'
import { space } from '../../../styles/tokens'
import PageEchecChargement from '../../../components/PageEchecChargement'
import BandeauChiffres from '../../../ui/BandeauChiffres'
import HistoSemaines from '../../../ui/HistoSemaines'
import GrilleSemaine from '../../../ui/GrilleSemaine'
import TableauSeances from '../../../ui/TableauSeances'
import {
  getPlan, subscribeToPlan,
  skipSession, adaptSessions,
  regeneratePlan, archivePlan, deletePlan, generatePlan, countUpcomingOnWatch,
} from '../../../lib/training'
import {
  formatGoalTime, daysUntil, currentWeekNumber, cleanText, onWatchWarning, todayISO,
} from '../constants'
import {
  seancesDeSemaine, kmFaits, kmSemaine, uneDecimale, formaterKm, compteARebours, histogramme,
  joursGrille, blocGrille, ligneTableau, bandeauPasse,
} from './vueSemaine'
import { useEnvoiMontre } from '../session/useEnvoiMontre'
import SkipSheet from '../session/SkipSheet'

const SAUT_ECHEC = 'La séance n\'a pas pu être sautée. Réessaie.'
const ADAPTATION_ECHEC = 'L\'adaptation n\'a pas abouti. Réessaie.'

// Carte d'attente en tête de page : son écart du bas s'ouvre et se replie avec elle,
// rien n'est ajouté entre les cartes du dashboard quand elle est repliée.
const CARTE_ATTENTE_SX = { '& .MuiCollapse-wrapperInner': { pb: space[12] } }

const nombreAdaptees = (n) =>
  (n > 0 ? `${n} séance${n > 1 ? 's' : ''} adaptée${n > 1 ? 's' : ''}` : 'Aucune séance à adapter')

/**
 * Dashboard d'un plan Training.
 * - Sur /training/plan/:planId : lit le plan de l'URL.
 * - Sur /training (TrainingEntree, lot T1b) : `planInitial`, déjà lu, s'affiche sans
 *   seconde lecture ni seconde barre ; `onPlanQuitte` relance l'entrée quand le plan
 *   est archivé ou supprimé (naviguer vers /training ne ferait rien, l'URL y est déjà).
 */
const PlanDashboard = ({ planInitial, onPlanQuitte }) => {
  const params = useParams()
  const planId = planInitial?.id ?? params.planId
  const navigate = useAppNavigate()
  const navigateSansTransition = useNavigate()
  const location = useLocation()
  const { setHeaderActions } = useAppCtx()
  const { afficher } = useMessage()

  const [plan, setPlan] = useState(planInitial ?? null)
  const [loading, setLoading] = useState(!planInitial)
  const [loadError, setLoadError] = useState(null)
  // Relance du chargement (« Réessayer » de la carte d'échec).
  const [essai, setEssai] = useState(0)

  const [regenBusy, setRegenBusy] = useState(false)

  // Semaine sélectionnée : null tant que l'utilisateur n'a pas choisi → on retombe
  // sur la semaine courante (état dérivé plutôt que miroir dans un effet).
  // Persistée en sessionStorage pour survivre à un aller-retour vers une séance.
  const weekStorageKey = `training:selectedWeek:${planId}`
  const [selectedWeek, setSelectedWeek] = useState(() => {
    const v = sessionStorage.getItem(`training:selectedWeek:${planId}`)
    return v ? Number(v) : null
  })

  // Feuille « Sauter » : la séance visée reste posée pendant la fermeture de la feuille.
  const [sautCible, setSautCible] = useState(null)
  const [sautOuvert, setSautOuvert] = useState(false)
  const [regenOuverte, setRegenOuverte] = useState(false)
  const [regenOnWatch, setRegenOnWatch] = useState(0) // séances envoyées qui vont disparaître
  const [archiveOuverte, setArchiveOuverte] = useState(false)
  const [genTimedOut, setGenTimedOut] = useState(false)
  const [adaptTitre, setAdaptTitre] = useState('')

  const attente = useFinAttente(loading)

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
    // Plan reçu de l'entrée /training : rien à lire au premier passage ; « Réessayer »
    // (essai) et reloadPlan relisent avec getPlan.
    if (planInitial && planInitial.id === planId && essai === 0) return undefined
    let cancelled = false
    getPlan(planId)
      .then((p) => { if (!cancelled) { setPlan(p); setLoading(false) } })
      .catch((e) => {
        console.error('[PlanDashboard] chargement :', e)
        if (!cancelled) { setLoadError('Les données n\'ont pas pu être chargées.'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [planId, essai, planInitial])

  const reessayer = () => {
    setLoading(true)
    setLoadError(null)
    setEssai((n) => n + 1)
  }

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

  // Après un envoi sur la montre : plan relu sans repasser par l'écran de chargement.
  const envoi = useEnvoiMontre({ onEnvoye: reloadPlan })

  // ── Actions du header ─────────────────────────────────────────────────────────
  const readOnly = plan?.status !== 'active'
  useEffect(() => {
    if (!plan || plan.generation_status !== 'ready') { setHeaderActions([]); return }
    const actions = []
    if (!readOnly) {
      actions.push({ label: 'Régénérer les semaines restantes', onClick: () => { setRegenOnWatch(0); setRegenOuverte(true) } })
      actions.push({ label: 'Archiver ce plan', onClick: () => setArchiveOuverte(true) })
    }
    actions.push({ label: 'Historique des séances', onClick: () => navigate('/historique', { direction: 'forward', state: { retour: `${location.pathname}${location.search}` } }) })
    actions.push({ label: 'Historique des plans', onClick: () => navigate('/training?view=history', { direction: 'forward' }) })
    actions.push({ label: 'Réglages', onClick: () => navigate('/training/settings', { direction: 'forward' }) })
    // Plan en cours : pastille de la semaine sélectionnée ; plan passé : titre au nom du plan.
    setHeaderActions(actions, plan.race_name, readOnly
      ? { titreBarre: plan.race_name }
      : { pastille: `S${effectiveWeek} / ${plan.weeks.length}` })
    return () => setHeaderActions([])
  }, [plan, readOnly, effectiveWeek, navigate, setHeaderActions, location.pathname, location.search])

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

  const marquerSautee = (id) => setPlan((p) => (p
    ? { ...p, sessions: p.sessions.map((s) => (s.id === id ? { ...s, status: 'skipped' } : s)) }
    : p))

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
        await reloadPlan()
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

  const seanceDe = (id) => plan?.sessions?.find((s) => s.id === id)

  const handleOpen = (id) =>
    navigate(`/training/plan/${planId}/session/${id}`)

  // Glisser « Envoyer » : feuille Date d'envoi sur la montre (séance pas encore envoyée).
  const handlePush = (id) => { const s = seanceDe(id); if (s) envoi.ouvrir(s) }

  const handleSkipId = (id) => { const s = seanceDe(id); if (s) handleSkip(s) }

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
    if (ok) {
      if (onPlanQuitte) onPlanQuitte()
      else navigate('/training')
    }
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
    try {
      await deletePlan(planId)
      if (onPlanQuitte) onPlanQuitte()
      else navigate('/training')
    } catch (e) { echec(e, 'Le plan n\'a pas pu être supprimé. Réessaie.') }
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
    return <PageEchecChargement titre="Impossible de charger ton plan" onReessayer={reessayer} />
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
  const aujourdhui = todayISO()
  const effWeekObj = weeks.find((w) => w.week_number === effectiveWeek)
  const seances = effWeekObj ? seancesDeSemaine(plan.sessions, effWeekObj.id) : []
  const histo = histogramme(weeks)

  const bandeau = readOnly
    ? <BandeauChiffres cellules={bandeauPasse(plan, plan.sessions)} petite />
    : (
      <BandeauChiffres
        etiquetteSouple
        cellules={[
          { etiquette: plan.race_name, valeur: compteARebours(daysUntil(plan.race_date)) },
          { etiquette: 'Objectif', valeur: formatGoalTime(plan.goal_time_sec) ?? '-' },
          {
            etiquette: 'Semaine',
            nombre: kmFaits(seances),
            formater: formaterKm,
            sous: `/ ${uneDecimale(kmSemaine(effWeekObj))} km`,
          },
        ]}
      />
    )

  return (
    <>
      <Page gap={0}>
        {/* Cartes d'attente : repliées, elles n'ajoutent aucun écart. */}
        <BarreAttente place="carte" {...adaptation.barre} sx={CARTE_ATTENTE_SX}
          detail={`${adaptTitre} est sautée. Les séances des 10 prochains jours sont recalculées.`} />
        <BarreAttente place="carte" {...saut.barre} sx={CARTE_ATTENTE_SX} />
        <BarreAttente place="carte" {...archivage.barre} sx={CARTE_ATTENTE_SX} />
        <BarreAttente place="carte" {...envoi.action.barre} sx={CARTE_ATTENTE_SX} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          {bandeau}

          <HistoSemaines
            semaines={histo.semaines}
            max={histo.max}
            blocs={histo.blocs}
            selection={effectiveWeek}
            onChoisir={selectWeek}
          />

          <GrilleSemaine
            jours={joursGrille(effWeekObj?.start_date, aujourdhui)}
            blocs={seances.map((s) => blocGrille(s, plan, aujourdhui))}
            onOuvrir={handleOpen}
            vide="Aucune séance pour cette semaine."
          />

          {seances.length > 0 && (
            <TableauSeances
              lignes={seances.map((s) => ligneTableau(s, readOnly))}
              glisser={!readOnly}
              onOuvrir={handleOpen}
              onSauter={handleSkipId}
              onEnvoyer={handlePush}
            />
          )}
        </Box>
      </Page>

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

      {/* Feuilles d'envoi sur la montre (glisser) */}
      {envoi.feuilles}

      <FeuilleFlottante
        ouverte={archiveOuverte}
        onFermer={() => setArchiveOuverte(false)}
        titre={`${plan.race_name} passera en lecture seule et rejoindra tes anciens plans. Tu pourras créer un nouveau plan.`}
        lignes={[{ libelle: 'Archiver le plan', onClick: doArchive }]}
        fermerLibelle="Annuler"
      />
    </>
  )
}

export default PlanDashboard
