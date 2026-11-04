import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { texteErreur } from '../../../lib/reseau'
import { useMessage } from '../../../ui/useMessage'
import { Box, Typography, Button, Alert, Menu, MenuItem } from '@mui/material'
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
import { glassSx, cardSx } from '../../../styles/glass'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import BarreAttente from '../../../ui/BarreAttente'
import BarreBas from '../../../ui/BarreBas'
import Bouton from '../../../ui/Bouton'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import { space } from '../../../styles/tokens'
import {
  getSession, skipSession, unskipSession,
  completeSession, resetSession, updateOnCoros,
} from '../../../lib/training'
import {
  ZONE_STYLE, NEUTRAL_STYLE, ZONE_LABEL, TYPE_LABEL, STATUS_LABEL, ADAPTED_STYLE, VERDICT,
  intensityOf, formatKm, formatPace, formatDistance, formatDuration, formatMin,
  cleanText, shortDayLabel, formatLongDay, isCorosCopyUpcoming,
} from '../constants'
import {
  groupSteps, totalMeters, totalSeconds, keyPaceSec, stepSizeLabel,
} from '../sessionMath'
import PaceChart from './PaceChart'
import { useEnvoiMontre } from './useEnvoiMontre'
import SkipSheet from './SkipSheet'

// ── Styles de chips de statut ────────────────────────────────────────────────
// Le statut ne porte pas de couleur : chips neutres, la sautée en muted.
const STATUS_CHIP = {
  planned: NEUTRAL_STYLE,
  done:    NEUTRAL_STYLE,
  adapted: ADAPTED_STYLE,
  skipped: { main: 'var(--muted)', bg: 'var(--chip)' },
}

const STEP_ICON = {
  warmup: LocalFireDepartment,
  interval: Bolt,
  run: DirectionsRun,
  recovery: PauseCircle,
  cooldown: Bedtime,
}

// Carte d'attente en tête de page : l'écart du haut s'ouvre et se replie avec elle.
const CARTE_ATTENTE_SX = { '& .MuiCollapse-wrapperInner': { pt: 1.5 } }

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
  const { afficher } = useMessage()
  const attente = useFinAttente(loading)

  const [sautOuvert, setSautOuvert] = useState(false)
  const [reinitOuverte, setReinitOuverte] = useState(false)
  const [watchAnchor, setWatchAnchor] = useState(null) // menu "Sur la montre"

  const echec = (e, phrase) => afficher(texteErreur(e, phrase))
  const RECHARGEMENT = 'Les données n\'ont pas pu être rechargées. Réessaie.'

  // Actions réseau : chacune a sa carte d'attente en tête de page.
  const saut = useAction({
    attente: 'Saut de la séance', duree: DUREES.actionCourte,
    echec: 'La séance n\'a pas pu être sautée. Réessaie.',
  })
  const reinit = useAction({
    attente: 'Réinitialisation de la séance', duree: DUREES.actionCourte,
    echec: 'La séance n\'a pas pu être réinitialisée. Réessaie.',
  })
  const delier = useAction({
    attente: 'Réinitialisation de la séance', duree: DUREES.validation,
    echec: 'La séance n\'a pas pu être déliée. Réessaie.',
  })
  // Phrase figée au lancement : le statut change à la réponse, pendant le repli de la carte.
  const [restaurerPhrase, setRestaurerPhrase] = useState('')
  const restaurer = useAction({
    attente: restaurerPhrase, duree: DUREES.envoiMontre,
    echec: 'La séance n\'a pas pu être restaurée. Réessaie.',
  })
  const montre = useAction({
    attente: 'Mise à jour de ta montre', duree: DUREES.envoiMontre,
    succes: (res) => {
      if (res.status === 'updated') return 'Montre mise à jour'
      if (res.status === 'past') return 'La séance sur la montre est déjà passée.'
      console.error('[training séance] mise à jour de la montre :', res.error)
      return 'La mise à jour de ta montre n\'a pas abouti. Réessaie.'
    },
    echec: 'La mise à jour de ta montre n\'a pas abouti. Réessaie.',
  })

  const reload = useCallback(async () => {
    const s = await getSession(sessionId)
    setSession(s)
    return s
  }, [sessionId])

  const envoi = useEnvoiMontre({ onEnvoye: reload })

  const actions = [saut, reinit, delier, restaurer, montre, envoi.action]
  const locked = actions.some((a) => a.enCours)
  // Action en cours : le toucher est ignoré, la carte d'attente est déjà en tête de page.
  const siLibre = (fn) => () => { if (!locked) fn() }

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
      .catch((e) => {
        console.error('[training séance] chargement :', e)
        if (!cancelled) { setLoadError('Les données n\'ont pas pu être chargées.'); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [sessionId])

  // ── Handlers ────────────────────────────────────────────────────────────────
  // Rien n'est écrit avant le choix dans la feuille. « Sauter et adapter » : le
  // dashboard lance l'adaptation (location.state.adapter) et montre sa carte.
  const sauter = async (adapter) => {
    const { ok } = await saut.lancer(() => skipSession(sessionId))
    if (!ok) return
    if (adapter) {
      navigate(`/training/plan/${planId}`, {
        state: { adapter: { sessionId, titre: cleanText(session.title) } },
      })
      return
    }
    setSession((s) => ({ ...s, status: 'skipped' }))
  }

  const doReset = () => reinit.lancer(async () => {
    await resetSession(sessionId)
    await reload()
  })

  // « Délier Coros » garde le ressenti, jusqu'à son retrait en T2.
  const doDelink = () => delier.lancer(async () => {
    await resetSession(sessionId, { garderRessenti: true })
    await completeSession(sessionId)
    await reload()
  })

  const doRestore = () => {
    setRestaurerPhrase(session.status === 'skipped' ? 'Reprise de la séance' : 'Restauration de la séance')
    restaurer.lancer(async () => {
      const { corosError } = await unskipSession(sessionId)
      await reload()
      if (corosError) {
        console.error('[training séance] restauration sur la montre :', corosError)
        afficher('Séance restaurée, mais pas sur ta montre.')
      }
    })
  }

  // Remplace le contenu de la copie Coros par la version actuelle de la séance.
  const doUpdateCoros = () => {
    setWatchAnchor(null)
    montre.lancer(async () => {
      const res = await updateOnCoros(sessionId)
      await reload().catch((e) => echec(e, RECHARGEMENT))
      return res
    })
  }

  // ── États de rendu ────────────────────────────────────────────────────────
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
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: '1 0 auto', width: '100%', maxWidth: 640, mx: 'auto', px: 2, pb: (canComplete || isDone) ? space[24] : 6 }}>

        {/* ── Cartes d'attente ────────────────────────────────────── */}
        {actions.map((a, i) => (
          <BarreAttente key={i} place="carte" {...a.barre} sx={CARTE_ATTENTE_SX} />
        ))}

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
            icon={<AutoAwesome sx={{ fontSize: 18, color: 'ink' }} />}
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
                onClick={isPushed ? (e) => setWatchAnchor(e.currentTarget) : () => envoi.ouvrir(session)}
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
                <MenuItem onClick={doUpdateCoros}>Mettre à jour</MenuItem>
                <MenuItem onClick={() => { setWatchAnchor(null); envoi.ouvrir(session) }}>
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

      {/* ── Barre du bas ─────────────────────────────────────────── */}
      {(canComplete || isDone) && (
        <BarreBas>
          {canComplete && (
            <>
              <Bouton variante="chip" onClick={siLibre(() => setSautOuvert(true))} sx={{ flex: 1, minWidth: 0 }}>
                Sauter
              </Bouton>
              <Bouton
                variante="ink"
                onClick={siLibre(() => navigate(`/training/plan/${planId}/session/${sessionId}/valider`, { direction: 'forward' }))}
                sx={{ flex: 2, minWidth: 0 }}
              >
                Valider la séance
              </Bouton>
            </>
          )}
          {isDone && (
            <>
              <Bouton variante="chip" onClick={siLibre(() => setReinitOuverte(true))} sx={{ flex: 1, minWidth: 0 }}>
                Réinitialiser
              </Bouton>
              {session.coros_activity_id && (
                <Bouton variante="chip" onClick={siLibre(doDelink)} sx={{ flex: 1, minWidth: 0 }}>
                  Délier Coros
                </Bouton>
              )}
            </>
          )}
        </BarreBas>
      )}

      {/* ── Feuilles ─────────────────────────────────────────────── */}
      {envoi.feuilles}

      <SkipSheet
        session={session}
        ouverte={sautOuvert}
        onFermer={() => setSautOuvert(false)}
        onAdapter={() => sauter(true)}
        onSansAdapter={() => sauter(false)}
      />

      <FeuilleFlottante
        ouverte={reinitOuverte}
        onFermer={() => setReinitOuverte(false)}
        titre={`${cleanText(session.title)} repassera à faire. Les activités liées, l'analyse et ton ressenti seront effacés.`}
        lignes={[{ libelle: 'Réinitialiser la séance', onClick: doReset }]}
        fermerLibelle="Annuler"
      />

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
          display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'chip',
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
