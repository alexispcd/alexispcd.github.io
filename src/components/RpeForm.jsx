import { Box, Typography, Slider, TextField } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { PAIN_CHIPS } from '../lib/feedback'

const rpeHelper = (rpe) => {
  if (rpe <= 3) return 'Facile'
  if (rpe <= 6) return 'Modéré'
  if (rpe <= 8) return 'Dur'
  return 'Maximal'
}

/**
 * Saisie du ressenti post-séance : effort perçu (RPE 1-10), zones douloureuses
 * et note libre. Composant contrôlé, sans logique de soumission.
 * value = { rpe, painAreas, note }, onChange reçoit le nouvel objet complet.
 * `accentColor` : couleur d'accent (#rrggbb), couleur primaire du thème par défaut.
 */
const RpeForm = ({ value, onChange, accentColor }) => {
  const theme = useTheme()
  const main = accentColor ?? theme.palette.primary.main
  const accent = { main, bg: alpha(main, 0.14) }
  const { rpe, painAreas, note } = value
  const set = (patch) => onChange({ ...value, ...patch })

  const toggleArea = (code) => {
    const on = painAreas.includes(code)
    set({ painAreas: on ? painAreas.filter((c) => c !== code) : [...painAreas, code] })
  }

  const displayRpe = rpe ?? 5

  return (
    <Box>
      {/* Effort perçu */}
      <Typography variant="overline" sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mb: 0.5 }}>
        Effort perçu
      </Typography>
      <Box sx={{ textAlign: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '2.4rem', fontWeight: 750, lineHeight: 1, color: rpe == null ? 'text.disabled' : accent.main, fontVariantNumeric: 'tabular-nums' }}>
          {rpe == null ? '?' : rpe}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {rpe == null ? 'Glisse pour noter ton effort' : `${rpeHelper(rpe)} · sur 10`}
        </Typography>
      </Box>
      <Box sx={{ px: 1 }}>
        <Slider
          value={displayRpe}
          onChange={(_, v) => set({ rpe: v })}
          min={1}
          max={10}
          step={1}
          marks
          valueLabelDisplay="off"
          sx={{ color: accent.main }}
        />
      </Box>

      {/* Douleurs */}
      <Typography variant="overline" sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 1.5, mb: 1 }}>
        Douleurs
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {PAIN_CHIPS.map((chip) => {
          const on = painAreas.includes(chip.code)
          return (
            <Box
              key={chip.code}
              onClick={() => toggleArea(chip.code)}
              sx={{
                px: 1.5, py: 0.75, borderRadius: '12px', cursor: 'pointer', userSelect: 'none',
                fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap',
                border: '1px solid',
                borderColor: on ? accent.main : 'divider',
                bgcolor: on ? accent.bg : 'transparent',
                color: on ? accent.main : 'text.secondary',
                transition: 'all .15s',
              }}
            >
              {chip.label}
            </Box>
          )
        })}
      </Box>

      {/* Note libre */}
      <Typography variant="overline" sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 1.5, mb: 1 }}>
        Commentaire
      </Typography>
      <TextField
        value={note}
        onChange={(e) => set({ note: e.target.value })}
        placeholder="Un commentaire ?"
        multiline
        rows={2}
        fullWidth
        size="small"
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
      />
    </Box>
  )
}

export default RpeForm
