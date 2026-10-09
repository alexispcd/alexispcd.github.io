import { Box, Typography } from '@mui/material'
import { cardSx } from '../../../styles/glass'
import { ANCHOR_LABELS, equipmentSummary } from '../content'
import BandChip from '../BandChip'

// Matériel à préparer : hauteurs de barre dans l'ordre d'usage, chaise, bandes.
const EquipmentBox = ({ content, bandsUsed, bands }) => {
  const { anchors, chair, bands: kgs } = equipmentSummary(content, bandsUsed)
  const items = [...anchors.map((a) => ANCHOR_LABELS[a]), ...(chair ? ['Chaise'] : [])]
  if (!items.length && !kgs.length) return null
  return (
    <Box sx={{ ...cardSx, borderRadius: '20px', p: 2, mt: 2 }}>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled' }}>
        Matériel
      </Typography>
      {items.length > 0 && (
        <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
          {items.join(' · ')}
        </Typography>
      )}
      {kgs.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {kgs.map((kg) => <BandChip key={kg} kg={kg} bands={bands} />)}
        </Box>
      )}
    </Box>
  )
}

export default EquipmentBox
