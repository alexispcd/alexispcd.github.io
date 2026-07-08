import { Box, Typography, Button, Divider } from '@mui/material'
import EditOutlined from '@mui/icons-material/EditOutlined'
import { GlassCard } from '../WizardParts'
import { resolveDistanceM } from '../draft'
import { raceDistanceLabel, parseTimeInput, formatGoalTime } from '../../constants'

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

const Row = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
  </Box>
)

const SectionCard = ({ title, onEdit, children }) => (
  <GlassCard sx={{ mt: 1.5, p: 2 }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
      <Typography variant="body2" fontWeight={700}>{title}</Typography>
      <Button
        size="small"
        startIcon={<EditOutlined sx={{ fontSize: '15px !important' }} />}
        onClick={onEdit}
        sx={{ color: 'text.secondary', fontSize: '0.7rem', minWidth: 0 }}
      >
        Modifier
      </Button>
    </Box>
    {children}
  </GlassCard>
)

const StepReview = ({ draft, goTo }) => {
  const distanceM = resolveDistanceM(draft)
  const distLabel = raceDistanceLabel(distanceM) || (distanceM ? `${(distanceM / 1000).toFixed(1)} km` : '—')
  const goalSec = parseTimeInput(draft.goalTime)
  const races = draft.previousRaces.filter((r) => r.name.trim())

  return (
    <Box>
      <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
        Récapitulatif
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Vérifie avant de générer. Tu peux revenir sur chaque étape.
      </Typography>

      <SectionCard title="Course" onEdit={() => goTo(0)}>
        <Row label="Nom" value={draft.name || '—'} />
        <Row label="Date" value={formatDate(draft.date)} />
        <Row label="Distance" value={distLabel} />
        {Number(draft.elevationM) > 0 && <Row label="Dénivelé" value={`${draft.elevationM} m D+`} />}
      </SectionCard>

      <SectionCard title="Forme" onEdit={() => goTo(1)}>
        <Row label="Source" value={draft.source === 'coros' ? 'Coros' : 'Manuelle'} />
        <Row label="VMA" value={draft.vmaKmh ? `${draft.vmaKmh} km/h` : '—'} />
        {draft.thresholdPace && <Row label="Allure seuil" value={`${draft.thresholdPace} /km`} />}
        {draft.vo2max && <Row label="VO2max" value={draft.vo2max} />}
      </SectionCard>

      <SectionCard title="Objectif" onEdit={() => goTo(2)}>
        <Row label="Temps cible" value={goalSec != null ? formatGoalTime(goalSec) : '—'} />
        {races.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            {races.map((r, i) => (
              <Row key={i} label={r.name} value={r.time || '—'} />
            ))}
          </>
        )}
        {draft.notes.trim() && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
              {draft.notes.trim()}
            </Typography>
          </>
        )}
      </SectionCard>
    </Box>
  )
}

export default StepReview
