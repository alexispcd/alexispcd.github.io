import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, IconButton, Chip, CircularProgress, Button } from '@mui/material'
import { ChevronLeft, ChevronRight, EmojiEvents, Schedule } from '@mui/icons-material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { getPlanSessions } from '../../../lib/training'
import SessionCard from './SessionCard'
import SessionDetail from './SessionDetail'

const ZONE_ORDER = ['A', 'B', 'C', 'renfo']

function getCurrentWeekNumber(startDate) {
  const start = new Date(startDate)
  const today = new Date()
  if (today < start) return 1
  return Math.floor((today - start) / (7 * 24 * 3600 * 1000)) + 1
}

function weekDateRange(startDate, weekNumber) {
  const start = new Date(startDate)
  const weekStart = new Date(start.getTime() + (weekNumber - 1) * 7 * 24 * 3600 * 1000)
  const weekEnd   = new Date(weekStart.getTime() + 6 * 24 * 3600 * 1000)
  return { weekStart, weekEnd }
}

function formatRange(start, end) {
  const opts = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('fr-FR', opts)} – ${end.toLocaleDateString('fr-FR', opts)}`
}

const PlanDashboard = ({ plan, readOnly = false, onBack, onRegeneratePlan }) => {
  const [sessions,       setSessions]       = useState(null)
  const [maxWeek,        setMaxWeek]        = useState(1)
  const [selectedWeek,   setSelectedWeek]   = useState(1)
  const [detailSession,  setDetailSession]  = useState(null)

  // Rechargement silencieux (ne réinitialise pas selectedWeek)
  const reloadSessions = useCallback(async () => {
    try {
      const data = await getPlanSessions(plan.id)
      setSessions(data)
      setMaxWeek(data.reduce((m, s) => Math.max(m, s.week_number ?? 1), 1))
    } catch (err) {
      console.error('[PlanDashboard] reloadSessions error:', err.message)
    }
  }, [plan.id])

  // Chargement initial : positionne aussi la semaine courante
  useEffect(() => {
    setSessions(null)
    getPlanSessions(plan.id).then(data => {
      const max = data.reduce((m, s) => Math.max(m, s.week_number ?? 1), 1)
      const current = Math.min(Math.max(1, getCurrentWeekNumber(plan.start_date)), max || 1)
      setSessions(data)
      setMaxWeek(max)
      setSelectedWeek(current)
    })
  }, [plan.id, plan.start_date])

  // Sécurité : recharge les séances quand l'utilisateur revient sur l'onglet
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === 'visible') reloadSessions()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [reloadSessions])

  const currentWeekNum = getCurrentWeekNumber(plan.start_date)

  const weeksToRace = plan.race_date
    ? Math.ceil((new Date(plan.race_date) - new Date()) / (7 * 24 * 3600 * 1000))
    : null

  const weekSessions = (sessions ?? [])
    .filter(s => s.week_number === selectedWeek)
    .sort((a, b) => ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone))

  const { weekStart, weekEnd } = weekDateRange(plan.start_date, selectedWeek)

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>

      {/* Retour vers la liste */}
      {onBack && (
        <Box sx={{ px: 0.5, pt: 0.5 }}>
          <Button
            startIcon={<ChevronLeft />}
            onClick={onBack}
            size="small"
            sx={{ color: 'text.secondary', fontWeight: 400, fontSize: '0.82rem', letterSpacing: 0 }}
          >
            Mes plans
          </Button>
        </Box>
      )}

      {/* En-tête plan */}
      <Box sx={{ px: 2, pt: onBack ? 1 : 2.5, pb: 2 }}>
        {!readOnly && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <EmojiEvents sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography variant="overline" color="primary"
              sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', lineHeight: 1 }}>
              Plan actif
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>
            {plan.race_name ?? 'Plan en cours'}
          </Typography>
          {readOnly && (
            <Chip
              label={plan.status === 'completed' ? 'Terminé' : 'Archivé'}
              size="small"
              sx={{ height: 20, fontSize: '0.62rem', '& .MuiChip-label': { px: 0.75 }, mt: 0.25, flexShrink: 0 }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {plan.race_distance && (
            <Chip label={plan.race_distance} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem' }} />
          )}
          {plan.race_date && (
            <Chip
              label={new Date(plan.race_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
          )}
          {weeksToRace != null && weeksToRace > 0 && (
            <Chip
              icon={<Schedule sx={{ fontSize: '12px !important' }} />}
              label={`${weeksToRace} sem. restante${weeksToRace > 1 ? 's' : ''}`}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
          )}
          {plan.target_time && (
            <Chip
              label={`Objectif ${plan.target_time}`}
              size="small"
              color="primary"
              sx={{ height: 22, fontSize: '0.72rem' }}
            />
          )}
        </Box>
      </Box>

      {/* Sélecteur de semaine */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 1, py: 1.25,
          borderRadius: 2,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
        }}>
          <IconButton
            size="small"
            onClick={() => setSelectedWeek(w => Math.max(1, w - 1))}
            disabled={selectedWeek <= 1}
            sx={{ color: 'text.secondary' }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>

          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'center', mb: 0.25 }}>
              <Typography variant="body2" fontWeight={700}>
                Semaine {selectedWeek} / {maxWeek}
              </Typography>
              {selectedWeek === currentWeekNum && (
                <Chip
                  label="En cours"
                  size="small"
                  color="primary"
                  sx={{ height: 16, fontSize: '0.58rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
              {formatRange(weekStart, weekEnd)}
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => setSelectedWeek(w => Math.min(maxWeek, w + 1))}
            disabled={selectedWeek >= maxWeek}
            sx={{ color: 'text.secondary' }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Séances */}
      <Box sx={{ px: 2, display: 'flex', flexDirection: 'column', gap: 1.25, pb: 4 }}>
        {sessions === null && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {sessions !== null && weekSessions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 5 }}>
            Aucune séance pour cette semaine.
          </Typography>
        )}

        {weekSessions.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            onClick={() => setDetailSession(session)}
          />
        ))}
      </Box>

      <SessionDetail
        session={detailSession}
        plan={plan}
        open={detailSession !== null}
        onClose={() => setDetailSession(null)}
        onSessionUpdated={(updated) => {
          setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
          setDetailSession(updated)
        }}
        onAdaptationDone={reloadSessions}
        onRegeneratePlan={onRegeneratePlan}
        readOnly={readOnly}
      />

    </Box>
  )
}

export default PlanDashboard
