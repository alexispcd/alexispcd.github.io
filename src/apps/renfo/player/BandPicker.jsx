import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import BandChip from '../BandChip'

/**
 * Choix de la bande d'un exercice parmi celles du compte. Le choix vaut pour cet
 * exercice jusqu'à la fin de la séance. `zIndex` : au-dessus de la coque du player.
 */
const BandPicker = ({ open, exerciseName, assist, current, bands, zIndex, onClose, onPick }) => (
  <Dialog
    open={open}
    onClose={onClose}
    sx={{ zIndex }}
    fullWidth
    slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
  >
    <DialogTitle sx={{ fontWeight: 700, pb: 0.5 }}>Élastique</DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {exerciseName}{assist ? ' · plus il est fort, plus tu es aidé' : ''}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        {bands.map((b) => {
          const on = Number(b.kg) === Number(current)
          return (
            <BandChip
              key={b.id}
              kg={b.kg}
              color={b.color}
              onClick={() => onPick(b.kg)}
              sx={{
                minWidth: 64, height: 40, fontSize: '0.9rem',
                boxShadow: on ? (t) => `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${t.palette.primary.main}` : undefined,
              }}
            />
          )
        })}
      </Box>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose}>Fermer</Button>
    </DialogActions>
  </Dialog>
)

export default BandPicker
