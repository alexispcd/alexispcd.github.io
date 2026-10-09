import { Box, Typography } from '@mui/material'
import CheckCircle from '@mui/icons-material/CheckCircle'
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked'
import Schedule from '@mui/icons-material/Schedule'
import { cardSx } from '../../../styles/glass'
import { KIND_LABELS } from '../../../../supabase/functions/_shared/strength/rules.ts'
import { usedBands } from '../content'
import BandChip from '../BandChip'

// Carte d'une séance dans la semaine : type, titre, durée, bandes, statut.
const SessionCard = ({ session, bands, free = false, onOpen }) => {
  const done = session.status === 'done'
  const kgs = usedBands(session.content, session.bands_used)
  return (
    <Box
      onClick={onOpen}
      sx={{
        ...cardSx, borderRadius: '20px', p: 2, cursor: 'pointer',
        display: 'flex', gap: 1.5, alignItems: 'flex-start',
        opacity: done ? 0.75 : 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.main' }}>
            {KIND_LABELS[session.kind] ?? session.kind}
          </Typography>
          {free && (
            <Box sx={{ px: 0.75, py: 0.1, borderRadius: '6px', border: '1px solid', borderColor: 'divider', fontSize: '0.62rem', fontWeight: 700, color: 'text.secondary' }}>
              Libre
            </Box>
          )}
        </Box>
        <Typography variant="body1" fontWeight={700} sx={{ mt: 0.25, lineHeight: 1.25 }}>
          {session.title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {session.content?.estimated_min != null && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mr: 0.5, color: 'text.secondary' }}>
              <Schedule sx={{ fontSize: 15 }} />
              <Typography variant="caption">{session.content.estimated_min} min</Typography>
            </Box>
          )}
          {kgs.map((kg) => <BandChip key={kg} kg={kg} bands={bands} size="small" />)}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, color: done ? 'primary.main' : 'text.disabled', flexShrink: 0 }}>
        {done ? <CheckCircle /> : <RadioButtonUnchecked />}
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 600 }}>{done ? 'Faite' : 'À faire'}</Typography>
      </Box>
    </Box>
  )
}

export default SessionCard
