import { Box, Typography, IconButton } from '@mui/material'
import { ChevronLeft, ChevronRight, ArrowUpward, SwapHoriz } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { slopeColor } from './utils'

const ResultCard = ({ results, activeIdx, setActiveIdx }) => {
  const theme = useTheme()
  const r = results[activeIdx]
  const total = results.length

  const prev = () => setActiveIdx(i => Math.max(0, i - 1))
  const next = () => setActiveIdx(i => Math.min(total - 1, i + 1))

  return (
    <Box sx={{
      position: 'absolute',
      left: 8, right: 8,
      bottom: 64,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
    }}>
      <IconButton onClick={prev} disabled={activeIdx === 0} size="small"
        sx={{ color: 'text.secondary', opacity: activeIdx === 0 ? 0.2 : 1 }}>
        <ChevronLeft />
      </IconButton>

      <Box sx={{
        flex: 1,
        bgcolor: 'background.paper',
        borderRadius: 2.5,
        px: 1.5, py: 1.25,
        boxShadow: 2,
      }}>
        {/* Ligne 1 — nom + compteur */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
          <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, mr: 1 }}>
            {r.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: '0.65rem' }}>
            {activeIdx + 1} / {total}
          </Typography>
        </Box>

        {/* Ligne 2 — stats */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" fontWeight={600} sx={{ color: slopeColor(parseFloat(r.slope)), flexShrink: 0 }}>
            ▲ {r.slope}%
          </Typography>
          <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <ArrowUpward sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{r.gain}m</Typography>
          </Box>
          <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <SwapHoriz sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">{r.len}m</Typography>
          </Box>
        </Box>
      </Box>

      <IconButton onClick={next} disabled={activeIdx === total - 1} size="small"
        sx={{ color: 'text.secondary', opacity: activeIdx === total - 1 ? 0.2 : 1 }}>
        <ChevronRight />
      </IconButton>
    </Box>
  )
}

export default ResultCard