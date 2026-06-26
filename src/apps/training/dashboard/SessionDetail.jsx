import { useState, useRef, useEffect } from 'react'
import {
  Box, Typography, IconButton, Button, Chip,
  Dialog, DialogContent, DialogTitle, DialogActions, DialogContentText,
  Divider, CircularProgress,
} from '@mui/material'
import {
  ArrowBack, AutoAwesome, CheckCircle, SkipNext,
  FitnessCenter, Timer, Speed, DirectionsRun, Bolt, Close, Replay, UndoOutlined,
  Watch, LinkOff, AddLink, Insights, Remove,
} from '@mui/icons-material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { markSessionDone, skipSession, adaptSessions, resetSession, unskipSession, findCorosMatches, linkCorosSession, unlinkCorosSession, analyzeSession } from '../../../lib/training'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'

const DIALOG_PAPER = {
  sx: { ...glassSx, borderRadius: 3, mx: 2, maxWidth: 360, width: 'calc(100% - 32px)' },
}

// ── constantes ─────────────────────────────────────────────────────────────
const ZONE_STYLE = {
  A:     { bg: 'rgba(29,158,117,0.12)',  border: '#1D9E75', text: '#1D9E75', label: 'Zone A' },
  B:     { bg: 'rgba(249,115,22,0.12)',  border: '#f97316', text: '#f97316', label: 'Zone B' },
  C:     { bg: 'rgba(139,92,246,0.12)',  border: '#8b5cf6', text: '#8b5cf6', label: 'Zone C' },
  renfo: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#3b82f6', label: 'Renfo' },
}

const BLOCK_LABEL   = { construction: 'Construction', intensification: 'Intensification', affutage: 'Affûtage' }
const TYPE_LABEL    = { facile: 'Facile', 'fractionné': 'Fractionné', tempo: 'Tempo', sortie_longue: 'Sortie longue', renfo: 'Renfo' }
const STATUS_CHIP   = { faite: { label: 'Faite', color: 'success' }, sautée: { label: 'Sautée', color: 'default' }, adaptée: { label: 'Adaptée', color: 'warning' } }

const VERDICT_STYLE = {
  réussie:        { color: '#1D9E75', bg: 'rgba(29,158,117,0.12)', label: 'Séance réussie' },
  partiellement:  { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Partiellement réussie' },
  à_retravailler: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  label: 'À retravailler' },
}

const COMPARISON_ICON = {
  ok:     <CheckCircle sx={{ fontSize: 13, color: '#1D9E75', flexShrink: 0 }} />,
  proche: <Remove     sx={{ fontSize: 13, color: '#f97316', flexShrink: 0 }} />,
  écart:  <Close      sx={{ fontSize: 13, color: '#ef4444', flexShrink: 0 }} />,
}

// ── sous-composants ────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <Typography variant="overline" color="text.secondary"
    sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', display: 'block', mb: 1.25 }}>
    {children}
  </Typography>
)

const DetailRow = ({ label, value, strikethrough = false }) => {
  if (!value && value !== 0) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.875 }}>
      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, mr: 2 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{
        textAlign: 'right',
        textDecoration: strikethrough ? 'line-through' : 'none',
        color: strikethrough ? 'text.disabled' : 'text.primary',
      }}>
        {value}
      </Typography>
    </Box>
  )
}

// ── rendu des détails selon le type ───────────────────────────────────────
function RunningRows({ details, strikethrough = false }) {
  if (!details) return null
  const d = details
  return (
    <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', opacity: strikethrough ? 0.55 : 1, overflow: 'hidden' }}>
      <Box sx={{ px: 2 }}>
        {d.warmup && <><DetailRow label="Échauffement"    value={d.warmup}   strikethrough={strikethrough} /><Divider /></>}
        {d.reps && d.distance
          ? <><DetailRow label="Répétitions"  value={`${d.reps} × ${d.distance}`} strikethrough={strikethrough} /><Divider /></>
          : d.duration && <><DetailRow label="Durée" value={d.duration} strikethrough={strikethrough} /><Divider /></>
        }
        {d.pace      && <><DetailRow label="Allure cible"    value={d.pace}     strikethrough={strikethrough} /><Divider /></>}
        {d.recovery  && <><DetailRow label="Récupération"    value={d.recovery} strikethrough={strikethrough} /><Divider /></>}
        {d.cooldown  && <><DetailRow label="Retour au calme" value={d.cooldown} strikethrough={strikethrough} /><Divider /></>}
        {d.notes     && <DetailRow   label="Notes"           value={d.notes}    strikethrough={strikethrough} />}
      </Box>
    </Box>
  )
}

function RenfoRows({ details, strikethrough = false }) {
  if (!details?.exercises?.length) return null
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, opacity: strikethrough ? 0.55 : 1 }}>
      {details.exercises.map((ex, i) => (
        <Box key={i} sx={{ px: 2, py: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Typography variant="body2" fontWeight={600} sx={{
            mb: 0.25,
            textDecoration: strikethrough ? 'line-through' : 'none',
            color: strikethrough ? 'text.disabled' : 'text.primary',
          }}>
            {ex.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {[ex.sets && `${ex.sets} séries`, ex.reps && `${ex.reps} reps`, ex.duration, ex.rest && `Repos ${ex.rest}`].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

function SessionDetailsBlock({ type, details, strikethrough = false }) {
  if (type === 'renfo') return <RenfoRows details={details} strikethrough={strikethrough} />
  return <RunningRows details={details} strikethrough={strikethrough} />
}

// ── cible physiologique ────────────────────────────────────────────────────
const PHYS_HINTS = {
  facile:        { Icon: DirectionsRun, label: 'Allure facile',   hint: (s) => s?.threshold_pace ? `Seuil +45-60s/km (réf. ${s.threshold_pace})` : null },
  tempo:         { Icon: Speed,         label: 'Tempo',            hint: (s) => s?.threshold_pace ? `Allure seuil : ${s.threshold_pace}` : null },
  'fractionné':  { Icon: Bolt,          label: 'Intensité',        hint: (s) => s?.vma_derived    ? `~90-95% VMA (VMA ${s.vma_derived} km/h)` : null },
  sortie_longue: { Icon: Timer,         label: 'Sortie longue',    hint: (s) => s?.threshold_pace ? `Allure confortable, seuil +60-75s/km (réf. ${s.threshold_pace})` : null },
  renfo:         { Icon: FitnessCenter, label: 'Renforcement',     hint: ()  => 'Tapis de sol, exécution contrôlée, gainage et chaîne postérieure' },
}

function PhysioTarget({ type, fitnessSnapshot }) {
  const cfg = PHYS_HINTS[type]
  if (!cfg) return null
  const hintText = cfg.hint(fitnessSnapshot)
  if (!hintText) return null
  const { Icon } = cfg
  return (
    <Box sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Icon sx={{ fontSize: 18, color: 'primary.main', mt: 0.15, flexShrink: 0 }} />
      <Box>
        <Typography variant="caption" color="primary" fontWeight={600} sx={{ display: 'block', mb: 0.2 }}>{cfg.label}</Typography>
        <Typography variant="caption" color="text.secondary">{hintText}</Typography>
      </Box>
    </Box>
  )
}

// Survit aux démontages du composant — évite de perdre la date Coros quand on revient sur la séance
const _corosCache = new Map()

// ── composant principal ────────────────────────────────────────────────────
const SessionDetail = ({ session, plan, open, onClose, onSessionUpdated, onAdaptationDone, readOnly = false }) => {
  const [confirmDone,  setConfirmDone]  = useState(false)
  const [confirmSkip,  setConfirmSkip]  = useState(false)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [confirmUnskip, setConfirmUnskip] = useState(false)
  const [doneLoading,   setDoneLoading]   = useState(false)
  const [skipLoading,   setSkipLoading]   = useState(false)
  const [resetLoading,  setResetLoading]  = useState(false)
  const [unskipLoading, setUnskipLoading] = useState(false)
  // adaptState: null | 'loading' | { count: N } | { error: string }
  const [adaptState,  setAdaptState]  = useState(null)
  const adaptDismissed = useRef(false)
  // corosState: null | 'searching' | { matches: [] }
  const [corosState,     setCorosState]     = useState(null)
  const [linkLoading,    setLinkLoading]    = useState(false)
  // corosLinkedInfo: null | { date: 'YYYY-MM-DD', startTime: 'HH:MM' }
  const [corosLinkedInfo, setCorosLinkedInfo] = useState(null)
  // analysisState: null | 'loading' | AnalysisResult | { error: string }
  const [analysisState, setAnalysisState] = useState(null)

  useEffect(() => {
    setCorosState(null)
    setLinkLoading(false)
    setCorosLinkedInfo(_corosCache.get(session?.id) ?? null)
    setAnalysisState(session?.coros_analysis ?? null)
  }, [session?.id])

  if (!session) return null

  const zone       = ZONE_STYLE[session.zone] ?? ZONE_STYLE.A
  const isAdapted  = session.status === 'adaptée' && session.previous_details != null
  const statusChip = STATUS_CHIP[session.status]
  const canAnalyze  = session.status === 'faite' && !!session.coros_label_id && session.type !== 'renfo'
  const canMarkDone = session.status !== 'faite' && session.status !== 'sautée'
  const canSkip     = session.status !== 'sautée' && session.status !== 'faite'
  const canReset    = session.status === 'faite'
  const canUnskip   = session.status === 'sautée'

  // ── Analyse prévu vs réalisé ────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalysisState('loading')
    try {
      const result = await analyzeSession(session.id)
      setAnalysisState(result.analysis)
    } catch (err) {
      console.error('[Training] analyzeSession error:', err.message)
      setAnalysisState({ error: err.message })
    }
  }

  // ── Liaison Coros ──────────────────────────────────────────────────────
  const triggerCorosMatch = async (date) => {
    if (!date) return
    setCorosState('searching')
    try {
      const matches = await findCorosMatches(date, session.type)
      if (!matches || matches.length === 0) {
        setCorosState(null)
      } else if (matches.length === 1) {
        const info = { date: matches[0].date, startTime: matches[0].startTime ?? null }
        setCorosLinkedInfo(info)
        _corosCache.set(session.id, info)
        setLinkLoading(true)
        try {
          const updated = await linkCorosSession(session.id, matches[0].labelId)
          onSessionUpdated?.(updated)
        } catch (err) {
          console.error('[Training] auto-link error:', err.message)
          setCorosLinkedInfo(null)
          _corosCache.delete(session.id)
        } finally {
          setLinkLoading(false)
        }
        setCorosState(null)
      } else {
        setCorosState({ matches })
      }
    } catch (err) {
      console.error('[Training] findCorosMatches error:', err.message)
      setCorosState(null)
    }
  }

  const handleLinkMatch = async (match) => {
    setCorosState(null)
    const info = { date: match.date, startTime: match.startTime ?? null }
    setCorosLinkedInfo(info)
    _corosCache.set(session.id, info)
    setLinkLoading(true)
    try {
      const updated = await linkCorosSession(session.id, match.labelId)
      onSessionUpdated?.(updated)
    } catch (err) {
      console.error('[Training] linkCorosSession error:', err.message)
      setCorosLinkedInfo(null)
      _corosCache.delete(session.id)
    } finally {
      setLinkLoading(false)
    }
  }

  const handleUnlink = async () => {
    setLinkLoading(true)
    try {
      const updated = await unlinkCorosSession(session.id)
      onSessionUpdated?.(updated)
      setCorosLinkedInfo(null)
      _corosCache.delete(session.id)
    } catch (err) {
      console.error('[Training] unlinkCorosSession error:', err.message)
    } finally {
      setLinkLoading(false)
    }
  }

  // ── Marquer comme faite ─────────────────────────────────────────────────
  const handleDoneConfirm = async () => {
    setDoneLoading(true)
    try {
      const updated = await markSessionDone(session.id)
      onSessionUpdated?.(updated)
      setConfirmDone(false)
      const date = session.scheduled_date ?? new Date().toISOString().slice(0, 10)
      triggerCorosMatch(date)
    } catch (err) {
      console.error('[Training] markSessionDone error:', err.message)
    } finally {
      setDoneLoading(false)
    }
  }

  // ── Je saute ────────────────────────────────────────────────────────────
  const handleSkipConfirm = async () => {
    setSkipLoading(true)
    try {
      const updated = await skipSession(session.id)
      onSessionUpdated?.(updated)
    } catch (err) {
      console.error('[Training] skipSession error:', err.message)
      setSkipLoading(false)
      setConfirmSkip(false)
      return
    }
    setSkipLoading(false)
    setConfirmSkip(false)

    // Lancer l'adaptation en arrière-plan + afficher le dialog de suivi
    adaptDismissed.current = false
    setAdaptState('loading')

    try {
      const result = await adaptSessions(plan?.id, session.id)
      if (!adaptDismissed.current) {
        setAdaptState({ count: result?.adaptedCount ?? 0 })
      }
    } catch (err) {
      console.error('[Training] adaptSessions error:', err.message)
      if (!adaptDismissed.current) {
        setAdaptState({ count: 0, unavailable: true })
      }
    } finally {
      // Toujours recharger les séances après adaptation, que le popup soit ouvert ou non
      onAdaptationDone?.()
    }
  }

  // ── Annuler (reset faite → à_venir) ────────────────────────────────────
  const handleResetConfirm = async () => {
    setResetLoading(true)
    try {
      const updated = await resetSession(session.id)
      onSessionUpdated?.(updated)
      setConfirmReset(false)
    } catch (err) {
      console.error('[Training] resetSession error:', err.message)
    } finally {
      setResetLoading(false)
    }
  }

  // ── Annuler le saut (sautée → à_venir + restauration des séances adaptées) ─
  const handleUnskipConfirm = async () => {
    setUnskipLoading(true)
    try {
      const updated = await unskipSession(session.id)
      onSessionUpdated?.(updated)
      onAdaptationDone?.()
      setConfirmUnskip(false)
    } catch (err) {
      console.error('[Training] unskipSession error:', err.message)
    } finally {
      setUnskipLoading(false)
    }
  }

  const handleAdaptClose = () => {
    adaptDismissed.current = true
    setAdaptState(null)
  }

  const adaptIsLoading = adaptState === 'loading'
  const adaptIsDone    = adaptState !== null && adaptState !== 'loading'

  return (
    <>
      {/* ── Vue principale (Dialog fullscreen) ──────────────────────────── */}
      <Dialog open={open} onClose={onClose} fullScreen>
        <DialogContent sx={{ p: 0, bgcolor: 'background.default', display: 'flex', flexDirection: 'column', height: '100%' }}>

          {/* Barre de navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, pt: `${HEADER_HEIGHT + 8}px`, pb: 1, flexShrink: 0 }}>
            <IconButton onClick={onClose} size="small" edge="start">
              <ArrowBack fontSize="small" />
            </IconButton>
            <Box sx={{ px: 1.25, py: 0.4, borderRadius: 1.25, bgcolor: zone.bg, border: `1.5px solid ${zone.border}` }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: zone.text, lineHeight: 1 }}>{zone.label}</Typography>
            </Box>
            <Typography variant="body2" fontWeight={700} noWrap sx={{ flex: 1 }}>{session.title}</Typography>
            {statusChip && (
              <Chip label={statusChip.label} size="small" color={statusChip.color}
                sx={{ height: 20, fontSize: '0.62rem', '& .MuiChip-label': { px: 0.75 } }} />
            )}
          </Box>

          {/* Méta */}
          <Box sx={{ px: 2, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: 0 }}>
            <Typography variant="caption" color="text.secondary">{TYPE_LABEL[session.type] ?? session.type}</Typography>
            {session.block && (
              <>
                <Typography variant="caption" color="text.disabled">·</Typography>
                <Typography variant="caption" color="text.secondary">{BLOCK_LABEL[session.block] ?? session.block}</Typography>
              </>
            )}
            {isAdapted && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                <AutoAwesome sx={{ fontSize: 12, color: '#f97316' }} />
                <Typography variant="caption" sx={{ color: '#f97316', fontWeight: 600 }}>Séance adaptée</Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ flexShrink: 0 }} />

          {/* Corps scrollable */}
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2.5, display: 'flex', flexDirection: 'column', gap: 3 }}>

            {/* Comparaison avant/après */}
            {isAdapted && (
              <Box>
                <SectionTitle>Version originale</SectionTitle>
                <SessionDetailsBlock type={session.type} details={session.previous_details} strikethrough />
                <Box sx={{ mt: 2.5 }}>
                  <SectionTitle>Version adaptée</SectionTitle>
                  <SessionDetailsBlock type={session.type} details={session.details} />
                </Box>
              </Box>
            )}

            {/* Détail normal */}
            {!isAdapted && (
              <Box>
                <SectionTitle>{session.type === 'renfo' ? 'Exercices' : 'Détail de la séance'}</SectionTitle>
                <SessionDetailsBlock type={session.type} details={session.details} />
              </Box>
            )}

            {/* Cible physiologique */}
            {plan?.fitness_snapshot && (
              <Box>
                <SectionTitle>Cible physiologique</SectionTitle>
                <PhysioTarget type={session.type} fitnessSnapshot={plan.fitness_snapshot} />
              </Box>
            )}

            {/* Séance Coros */}
            {session.status === 'faite' && (
              <Box>
                <SectionTitle>Séance Coros</SectionTitle>
                {corosState === 'searching' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                    borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <CircularProgress size={14} sx={{ flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">
                      Recherche de la séance Coros...
                    </Typography>
                  </Box>
                ) : session.coros_label_id ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25,
                    borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Watch sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                    <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                      {corosLinkedInfo
                        ? (() => {
                            const [y, m, d] = corosLinkedInfo.date.split('-')
                            const time = corosLinkedInfo.startTime?.replace(':', 'h')
                            return `Séance du ${d}-${m}-${y}${time ? ` à ${time}` : ''} liée`
                          })()
                        : 'Séance liée'}
                    </Typography>
                    <IconButton size="small" onClick={handleUnlink} disabled={linkLoading}
                      sx={{ color: 'text.secondary' }}>
                      {linkLoading
                        ? <CircularProgress size={14} />
                        : <LinkOff sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </Box>
                ) : (
                  <Button size="small" startIcon={<AddLink />}
                    onClick={() => {
                      const date = session.scheduled_date
                        ?? session.completed_at?.slice(0, 10)
                        ?? new Date().toISOString().slice(0, 10)
                      triggerCorosMatch(date)
                    }}
                    sx={{ color: 'text.secondary', fontSize: '0.78rem', pl: 1 }}>
                    Lier une séance Coros
                  </Button>
                )}
              </Box>
            )}

            {/* Analyse prévu vs réalisé */}
            {canAnalyze && (
              <Box>
                <SectionTitle>Analyse prévu vs réalisé</SectionTitle>

                {!analysisState && (
                  <Button size="small" startIcon={<Insights sx={{ fontSize: 16 }} />}
                    onClick={handleAnalyze}
                    sx={{ color: 'text.secondary', fontSize: '0.78rem', pl: 1 }}>
                    Analyser ma séance
                  </Button>
                )}

                {analysisState === 'loading' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                    borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <CircularProgress size={14} sx={{ flexShrink: 0 }} />
                    <Typography variant="caption" color="text.secondary">
                      Analyse en cours, quelques secondes...
                    </Typography>
                  </Box>
                )}

                {analysisState?.error && (
                  <Box sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                    display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                      Analyse indisponible — {analysisState.error}
                    </Typography>
                    <Button size="small" onClick={handleAnalyze}
                      sx={{ color: 'text.secondary', fontSize: '0.7rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Réessayer
                    </Button>
                  </Box>
                )}

                {analysisState?.verdict && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {/* Verdict + bouton réanalyser */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1.5,
                        bgcolor: (VERDICT_STYLE[analysisState.verdict] ?? VERDICT_STYLE.partiellement).bg,
                        border: `1.5px solid ${(VERDICT_STYLE[analysisState.verdict] ?? VERDICT_STYLE.partiellement).color}` }}>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 700,
                          color: (VERDICT_STYLE[analysisState.verdict] ?? VERDICT_STYLE.partiellement).color, lineHeight: 1 }}>
                          {(VERDICT_STYLE[analysisState.verdict] ?? VERDICT_STYLE.partiellement).label}
                        </Typography>
                      </Box>
                      <Button size="small" onClick={handleAnalyze}
                        sx={{ color: 'text.disabled', fontSize: '0.7rem' }}>
                        Réanalyser
                      </Button>
                    </Box>

                    {/* Résumé */}
                    {analysisState.summary && (
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                        {analysisState.summary}
                      </Typography>
                    )}

                    {/* Tableau comparatif */}
                    {analysisState.comparison?.length > 0 && (
                      <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                        <Box sx={{ px: 2 }}>
                          {analysisState.comparison.map((row, i) => (
                            <Box key={i}>
                              {i > 0 && <Divider />}
                              <Box sx={{ py: 0.875, display: 'flex', alignItems: 'center', gap: 1 }}>
                                {COMPARISON_ICON[row.status] ?? COMPARISON_ICON.proche}
                                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                                  {row.label}
                                </Typography>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', display: 'block', lineHeight: 1.2 }}>
                                    prévu {row.planned}
                                  </Typography>
                                  <Typography variant="caption" fontWeight={600}>
                                    {row.actual}
                                  </Typography>
                                </Box>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}

                    {/* Conseil */}
                    {analysisState.advice && (
                      <Box sx={{ px: 2, py: 1.25, borderRadius: 2,
                        bgcolor: 'rgba(29,158,117,0.07)', border: '1px solid rgba(29,158,117,0.18)' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                          {analysisState.advice}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            )}

          </Box>

          {/* Actions */}
          {!readOnly && <Box sx={{ px: 2, pt: 1.5, pb: 3.5, flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {canMarkDone && (
              <Button variant="contained" disableElevation fullWidth startIcon={<CheckCircle />}
                onClick={() => setConfirmDone(true)}>
                Marquer comme faite
              </Button>
            )}
            {canSkip && (
              <Button variant="outlined" fullWidth startIcon={<SkipNext />}
                onClick={() => setConfirmSkip(true)}
                sx={{ color: 'text.secondary', borderColor: 'divider' }}>
                Je saute cette séance
              </Button>
            )}
            {canUnskip && (
              <Button variant="outlined" fullWidth startIcon={<UndoOutlined />}
                onClick={() => setConfirmUnskip(true)}
                sx={{ borderColor: 'divider', color: 'text.secondary' }}>
                Annuler le saut
              </Button>
            )}
            {canReset && (
              <Button fullWidth startIcon={<Replay sx={{ fontSize: 16 }} />}
                onClick={() => setConfirmReset(true)}
                sx={{ color: 'text.disabled', fontSize: '0.78rem', mt: 0.5 }}>
                Annuler la validation
              </Button>
            )}
          </Box>}

        </DialogContent>
      </Dialog>

      {/* ── Popup : Confirmer "faite" ────────────────────────────────────── */}
      <Dialog
        open={confirmDone}
        onClose={() => !doneLoading && setConfirmDone(false)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Marquer comme faite ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          La séance <strong>{session.title}</strong> sera enregistrée comme réalisée.
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmDone(false)} disabled={doneLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="contained" disableElevation onClick={handleDoneConfirm}
            disabled={doneLoading}
            startIcon={doneLoading ? <CircularProgress size={14} color="inherit" /> : <CheckCircle />}>
            {doneLoading ? 'Enregistrement...' : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup : Confirmer "Je saute" ─────────────────────────────────── */}
      <Dialog
        open={confirmSkip}
        onClose={() => !skipLoading && setConfirmSkip(false)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Sauter cette séance ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          Le plan sera adapté en conséquence. Cette action ne peut pas être annulée.
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmSkip(false)} disabled={skipLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="contained" disableElevation color="warning" onClick={handleSkipConfirm}
            disabled={skipLoading}
            startIcon={skipLoading ? <CircularProgress size={14} color="inherit" /> : <SkipNext />}>
            {skipLoading ? 'Mise à jour...' : 'Sauter'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup : Confirmer annulation du saut ─────────────────────────── */}
      <Dialog
        open={confirmUnskip}
        onClose={() => !unskipLoading && setConfirmUnskip(false)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Annuler ce saut ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          La séance reviendra à "à venir". Les séances qui avaient été adaptées suite à ce saut seront également restaurées dans leur version d'origine.
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmUnskip(false)} disabled={unskipLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="contained" disableElevation onClick={handleUnskipConfirm}
            disabled={unskipLoading}
            startIcon={unskipLoading ? <CircularProgress size={14} color="inherit" /> : <UndoOutlined />}>
            {unskipLoading ? 'Restauration...' : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup : Confirmer annulation ─────────────────────────────────── */}
      <Dialog
        open={confirmReset}
        onClose={() => !resetLoading && setConfirmReset(false)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Annuler cette séance ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          La séance <strong>{session.title}</strong> reviendra à l'état "à venir".
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setConfirmReset(false)} disabled={resetLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="outlined" onClick={handleResetConfirm} disabled={resetLoading}
            startIcon={resetLoading ? <CircularProgress size={14} color="inherit" /> : <Replay />}>
            {resetLoading ? 'Mise à jour...' : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup : Sélection séance Coros ──────────────────────────────── */}
      <Dialog
        open={Boolean(corosState?.matches?.length > 0)}
        onClose={() => setCorosState(null)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem', pr: 6 }}>
          Choisir la séance Coros
        </DialogTitle>
        <IconButton onClick={() => setCorosState(null)} size="small"
          sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
          <Close fontSize="small" />
        </IconButton>
        <DialogContent sx={{ pt: 0, pb: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 0.5 }}>
            {(corosState?.matches ?? []).map((m) => (
              <Box key={m.labelId} onClick={() => handleLinkMatch(m)}
                sx={{ px: 2, py: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider',
                  cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}>
                <Typography variant="body2" fontWeight={600}>{m.date}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {[m.distance, m.duration, m.avgPace].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2.5 }}>
          <Button fullWidth onClick={() => setCorosState(null)} sx={{ color: 'text.secondary' }}>
            Passer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Popup : Adaptation en cours / résultat ───────────────────────── */}
      <Dialog
        open={adaptState !== null}
        onClose={adaptIsLoading ? handleAdaptClose : handleAdaptClose}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        {adaptIsLoading && (
          <>
            <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem', pr: 6 }}>
              Adaptation en cours...
            </DialogTitle>
            <IconButton onClick={handleAdaptClose} size="small"
              sx={{ position: 'absolute', right: 12, top: 12, color: 'text.secondary' }}>
              <Close fontSize="small" />
            </IconButton>
            <Box sx={{ px: 3, pb: 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress size={20} sx={{ flexShrink: 0 }} />
              <Typography variant="body2" color="text.secondary">
                Claude adapte les prochaines séances. Tu peux fermer, ça continue en arrière-plan.
              </Typography>
            </Box>
          </>
        )}

        {adaptIsDone && (
          <>
            <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
              {adaptState?.error ? 'Séance sautée' : 'Séance sautée'}
            </DialogTitle>
            <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
              {adaptState?.unavailable
                ? 'La séance a été marquée comme sautée. L\'adaptation automatique sera disponible prochainement.'
                : adaptState?.error
                  ? `La séance a été sautée, mais l'adaptation a échoué : ${adaptState.error}`
                  : `${adaptState?.count ?? 0} séance${adaptState?.count !== 1 ? 's' : ''} adaptée${adaptState?.count !== 1 ? 's' : ''} dans le plan.`
              }
            </DialogContentText>
            <DialogActions sx={{ px: 2, pb: 2.5 }}>
              <Button fullWidth variant="contained" disableElevation onClick={handleAdaptClose}>
                OK
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  )
}

export default SessionDetail
