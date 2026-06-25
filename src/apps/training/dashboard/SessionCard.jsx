import { Box, Typography } from '@mui/material'
import { Done, AutoAwesome, Block } from '@mui/icons-material'

const ZONE_STYLE = {
  A:     { bg: 'rgba(29,158,117,0.12)', border: '#1D9E75', text: '#1D9E75', label: 'A' },
  B:     { bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: '#f97316', label: 'B' },
  C:     { bg: 'rgba(139,92,246,0.12)', border: '#8b5cf6', text: '#8b5cf6', label: 'C' },
  renfo: { bg: 'rgba(59,130,246,0.12)', border: '#3b82f6', text: '#3b82f6', label: 'R' },
}

const TYPE_DOT = {
  facile:       '#1D9E75',
  'fractionné': '#ef4444',
  tempo:        '#f97316',
  sortie_longue:'#8b5cf6',
  renfo:        '#3b82f6',
}

const TYPE_LABEL = {
  facile:       'Facile',
  'fractionné': 'Fractionné',
  tempo:        'Tempo',
  sortie_longue:'Sortie longue',
  renfo:        'Renfo',
}

function sessionSubtitle(session) {
  const d = session.details ?? {}
  if (session.type === 'fractionné' && d.reps && d.distance) {
    return `${d.reps}×${d.distance}`
  }
  if (session.type === 'renfo' && Array.isArray(d.exercises)) {
    return `${d.exercises.length} exercice${d.exercises.length > 1 ? 's' : ''}`
  }
  if (d.duration) return d.duration
  return null
}

const SessionCard = ({ session, onClick }) => {
  const zone = ZONE_STYLE[session.zone] ?? ZONE_STYLE.A
  const typeDot = TYPE_DOT[session.type] ?? '#888'
  const typeLabel = TYPE_LABEL[session.type] ?? session.type
  const subtitle = sessionSubtitle(session)

  const isDone    = session.status === 'faite'
  const isSkipped = session.status === 'sautée'
  const isAdapted = session.status === 'adaptée'

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.75,
        borderRadius: 2,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        border: '1px solid',
        borderColor: isDone ? 'success.main' : 'divider',
        bgcolor: isDone ? (theme => theme.palette.mode === 'dark' ? 'rgba(29,158,117,0.08)' : 'rgba(29,158,117,0.05)') : 'background.paper',
        opacity: isSkipped ? 0.5 : 1,
        transition: 'opacity 0.15s',
        '&:active': { opacity: 0.65 },
      }}
    >
      {/* Badge zone */}
      <Box sx={{
        width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: zone.bg,
        border: `1.5px solid ${zone.border}`,
      }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: zone.text, lineHeight: 1 }}>
          {zone.label}
        </Typography>
      </Box>

      {/* Texte */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.3 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ textDecoration: isSkipped ? 'line-through' : 'none' }}
          >
            {session.title}
          </Typography>
          {isAdapted && <AutoAwesome sx={{ fontSize: 12, color: '#f97316', flexShrink: 0 }} />}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: typeDot, flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary">{typeLabel}</Typography>
          {subtitle && (
            <>
              <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1 }}>·</Typography>
              <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Icône statut */}
      {isDone    && <Done  sx={{ fontSize: 18, color: 'success.main', flexShrink: 0 }} />}
      {isSkipped && <Block sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />}
    </Box>
  )
}

export default SessionCard
