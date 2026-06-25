import { Box, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { InfoOutlined } from '@mui/icons-material'

const PREVIOUS_EDITIONS = [
  { year: 2024, label: 'Auray-Vannes 2024', time: "1h47'32\"" },
  { year: 2025, label: 'Auray-Vannes 2025', time: "1h44'15\"" },
]

const Step4Previous = ({ planContext, updateContext }) => {
  const theme = useTheme()
  const selected = planContext.previousRaces ?? []

  const toggle = (edition) => {
    const exists = selected.some(r => r.year === edition.year)
    updateContext({
      previousRaces: exists
        ? selected.filter(r => r.year !== edition.year)
        : [...selected, edition],
    })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pb: 2 }}>

      <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
        Sélectionne les éditions passées de cette course. L'IA prendra en compte tes performances réelles pour calibrer le plan.
      </Typography>

      {PREVIOUS_EDITIONS.map((edition) => {
        const isSelected = selected.some(r => r.year === edition.year)
        return (
          <Box
            key={edition.year}
            onClick={() => toggle(edition)}
            sx={{
              p: 2, borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: isSelected
                ? `2px solid ${theme.palette.primary.main}`
                : `1px solid ${theme.palette.divider}`,
              bgcolor: isSelected ? 'primary.light' : 'background.paper',
            }}
          >
            <Typography variant="body2" fontWeight={600}
              color={isSelected ? 'primary.main' : 'text.primary'}>
              {edition.label}
            </Typography>
            <Typography variant="body2" fontWeight={500}
              color={isSelected ? 'primary.main' : 'text.secondary'}>
              {edition.time}
            </Typography>
          </Box>
        )
      })}

      <Box sx={{
        p: 2, borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid', borderColor: 'divider',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
          <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled' }} />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Analyse des performances
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" lineHeight={1.6} display="block">
          Les données réelles de ces sorties (allures, FC, splits) seront analysées par l'IA pour personnaliser ton plan.
        </Typography>
      </Box>

    </Box>
  )
}

export default Step4Previous
