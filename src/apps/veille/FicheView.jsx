import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Chip, TextField, Divider } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const FicheView = ({ article, onUpdateNote }) => {
  const theme = useTheme()
  const [note, setNote] = useState(article.note || '')
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved'
  const timerRef = useRef(null)

  const handleNoteChange = (e) => {
    const val = e.target.value
    setNote(val)
    setSaveStatus('saving')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await onUpdateNote(val)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 1000)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

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
          {article.key_points?.map((point, i) => (
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
          {article.tags?.map(tag => (
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
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.6rem' }}>
            Ma note
          </Typography>
          {saveStatus === 'saving' && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem' }}>
              Sauvegarde…
            </Typography>
          )}
          {saveStatus === 'saved' && (
            <Typography variant="caption" color="success.main" sx={{ fontSize: '0.65rem' }}>
              Sauvegardé ✓
            </Typography>
          )}
        </Box>
        <TextField
          multiline
          minRows={2}
          maxRows={6}
          fullWidth
          size="small"
          placeholder="Ajouter une note personnelle…"
          value={note}
          onChange={handleNoteChange}
        />
      </Box>
    </Box>
  )
}

export default FicheView
