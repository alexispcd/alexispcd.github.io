import { Box, TextField, Typography, Divider } from '@mui/material'

const Row = ({ label, value }) => value ? (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.75 }}>
    <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={500} sx={{ textAlign: 'right', ml: 2 }}>{value}</Typography>
  </Box>
) : null

const RACE_TYPE_LABELS = {
  '10km': '10 km', semi: 'Semi-marathon', marathon: 'Marathon', trail: 'Trail',
}
const VMA_SOURCE_LABELS = {
  coros: 'Coros', manual: 'Manuelle',
}
const PALIER_LABELS = {
  realistic: 'Réaliste', ambitious: 'Ambitieux', very_ambitious: 'Très ambitieux',
}

const formatDate = (dateStr) => {
  if (!dateStr) return null
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const Step5Summary = ({ planContext, updateContext }) => {
  const weeks = planContext.raceDate && planContext.startDate
    ? Math.round((new Date(planContext.raceDate) - new Date(planContext.startDate)) / (7 * 24 * 3600 * 1000))
    : null

  const objectifLabel = planContext.targetPalier
    ? `${PALIER_LABELS[planContext.targetPalier]} — ${planContext.targetTime}`
    : planContext.targetTime || null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pb: 2 }}>

      <Typography variant="overline" color="text.secondary"
        sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block' }}>
        Récapitulatif
      </Typography>

      <Box sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ px: 2 }}>
          <Row label="Course" value={planContext.raceName} />
          <Divider />
          <Row label="Type" value={RACE_TYPE_LABELS[planContext.raceType]} />
          {planContext.raceType === 'trail' && <>
            <Divider />
            <Row label="Distance trail" value={planContext.trailDistance} />
            <Divider />
            <Row label="D+" value={planContext.trailElevation ? `${planContext.trailElevation} m` : null} />
          </>}
          <Divider />
          <Row label="Date de course" value={formatDate(planContext.raceDate)} />
          <Divider />
          <Row label="Début du plan" value={formatDate(planContext.startDate)} />
          {weeks > 0 && <><Divider /><Row label="Durée du plan" value={`${weeks} semaines`} /></>}
          <Divider />
          <Row label="Source VMA" value={VMA_SOURCE_LABELS[planContext.vmaSource]} />
          {planContext.vmaSource === 'manual' && planContext.vmaManual && <>
            <Divider />
            <Row label="VMA" value={`${planContext.vmaManual} km/h`} />
          </>}
          {objectifLabel && <><Divider /><Row label="Objectif" value={objectifLabel} /></>}
        </Box>
      </Box>

      <Box>
        <Typography variant="overline" color="text.secondary"
          sx={{ fontSize: '0.65rem', letterSpacing: '0.12em', display: 'block', mb: 1 }}>
          Remarques (optionnel)
        </Typography>
        <TextField
          fullWidth multiline rows={3} size="small"
          placeholder="Blessure récente, contrainte horaire, semaine chargée..."
          value={planContext.notes}
          onChange={e => updateContext({ notes: e.target.value })}
        />
      </Box>

    </Box>
  )
}

export default Step5Summary
