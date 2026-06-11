import { useState } from 'react'
import { Box, Typography, Chip, TextField, Button, Divider } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const FicheView = ({ article, onUpdateNote }) => {
  const theme = useTheme()
  const [note, setNote] = useState(article.note || '')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onUpdateNote(note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Résumé */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
          Résumé
        </Typography>
        <Typography variant="body2" color="text.primary" lineHeight={1.7} sx={{ mt: 0.5 }}>
          {article.summary}
        </Typography>
      </Box>

      <Divider />

      {/* Points clés */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
          Points clés
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
          {article.key_points.map((point, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                bgcolor: theme.palette.primary.light,
                color: theme.palette.primary.main,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 600,
              }}>
                {i + 1}
              </Box>
              <Typography variant="body2" lineHeight={1.5} sx={{ pt: 0.2 }}>
                {point}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Tags thèmes */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
          Thèmes
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
          {article.tags.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{
                bgcolor: theme.palette.primary.light,
                color: theme.palette.primary.main,
                border: 'none',
                fontSize: '0.7rem',
              }}
            />
          ))}
        </Box>
      </Box>

      <Divider />

      {/* Note perso */}
      <Box>
        <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
          Ma note
        </Typography>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          size="small"
          placeholder="Ajouter une note personnelle…"
          value={note}
          onChange={e => { setNote(e.target.value); setSaved(false) }}
          sx={{ mt: 1 }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size="small"
            variant={saved ? 'text' : 'outlined'}
            color={saved ? 'success' : 'primary'}
            onClick={handleSave}
            disabled={note === (article.note || '') && !saved}
            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
          >
            {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

export default FicheView
