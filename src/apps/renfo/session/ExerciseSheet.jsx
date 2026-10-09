import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { ANCHOR_LABELS, photoUrl } from '../content'

// Rendus internes (fonctions, pas des composants : un composant par fichier).
const photo = (src, caption) => (
  <Box key={caption} sx={{ flex: 1, minWidth: 0 }}>
    <Box sx={{ borderRadius: '14px', overflow: 'hidden', bgcolor: '#ffffff', border: '1px solid', borderColor: 'divider', aspectRatio: '4 / 3' }}>
      <Box component="img" src={src} alt={caption} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>{caption}</Typography>
  </Box>
)

const line = (label, children) => (
  <Box sx={{ mt: 1.5 }}>
    <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled' }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ mt: 0.25, lineHeight: 1.5 }}>{children}</Typography>
  </Box>
)

/** Fiche d'un exercice : photos départ et arrivée, installation, description, conseil. */
const ExerciseSheet = ({ slug, onClose, zIndex }) => {
  const ex = slug ? EXERCISE_INDEX[slug] : null
  const start = slug ? photoUrl(slug, 0) : null
  return (
    <Dialog
      open={Boolean(ex)}
      onClose={onClose}
      fullWidth
      sx={zIndex ? { zIndex } : undefined}
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      {ex && (
        <>
          <DialogContent sx={{ pt: 2.5 }}>
            <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>{ex.name}</Typography>
            {ex.equipment.includes('bar') && ex.anchor && (
              <Typography variant="caption" color="text.secondary">{ANCHOR_LABELS[ex.anchor]}</Typography>
            )}
            {start && (
              <Box sx={{ display: 'flex', gap: 1.25, mt: 2 }}>
                {photo(start, 'Départ')}
                {photo(photoUrl(slug, 1), 'Arrivée')}
              </Box>
            )}
            {ex.setup && line('Installation', ex.setup)}
            {line('Mouvement', ex.description)}
            {line('Conseil', ex.tip)}
            {ex.unilateral && line('Côtés', "Un côté puis l'autre")}
            {ex.assist && line('Élastique', "Plus l'élastique est fort, plus tu es aidé")}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose}>Fermer</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  )
}

export default ExerciseSheet
