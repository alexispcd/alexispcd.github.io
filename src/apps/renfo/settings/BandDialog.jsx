import { useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  InputAdornment, TextField, Typography,
} from '@mui/material'
import Check from '@mui/icons-material/Check'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { BAND_PALETTE, formatKg, isHexColor, textOnColor } from '../bandColor'
import BandChip from '../BandChip'

const parseKg = (raw) => {
  const n = Number(String(raw).replace(',', '.').trim())
  return Number.isFinite(n) ? n : NaN
}

/**
 * Ajout ou modification d'un élastique : poids (unique pour le compte) et couleur.
 * `band` null pour un ajout. `onSave({ kg, color })` lève une erreur lisible en cas d'échec.
 */
const BandDialog = ({ open, band, bands, disabled, onClose, onSave }) => {
  const [kgInput, setKgInput] = useState('')
  const [color, setColor] = useState(BAND_PALETTE[0].hex)
  const [hexInput, setHexInput] = useState(BAND_PALETTE[0].hex)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [openedFor, setOpenedFor] = useState(null)

  // Réinitialisation à l'ouverture, ajustée pendant le rendu (pas d'effet).
  const openKey = open ? (band?.id ?? 'new') : null
  if (openKey !== openedFor) {
    setOpenedFor(openKey)
    if (openKey) {
      const initial = band?.color ?? BAND_PALETTE[0].hex
      setKgInput(band ? formatKg(band.kg) : '')
      setColor(initial)
      setHexInput(initial)
      setError(null)
      setSaving(false)
    }
  }

  const kg = parseKg(kgInput)
  const duplicate = Number.isFinite(kg) && bands.some((b) => b.id !== band?.id && Number(b.kg) === kg)
  const kgError = kgInput.trim() === ''
    ? null
    : !(kg > 0) ? 'Indique un poids supérieur à 0' : duplicate ? 'Tu as déjà un élastique de ce poids' : null
  const valid = kg > 0 && !duplicate && isHexColor(color)

  const pick = (hex) => {
    setColor(hex)
    setHexInput(hex)
  }

  const onHexChange = (value) => {
    const v = value.startsWith('#') ? value : `#${value}`
    setHexInput(v)
    if (isHexColor(v)) setColor(v.toUpperCase())
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave({ kg, color })
    } catch (e) {
      setError(e.message || "L'enregistrement a échoué")
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>{band ? "Modifier l'élastique" : 'Ajouter un élastique'}</DialogTitle>
      <DialogContent>
        <TextField
          label="Résistance"
          value={kgInput}
          onChange={(e) => setKgInput(e.target.value)}
          error={Boolean(kgError)}
          helperText={kgError ?? ' '}
          fullWidth
          size="small"
          autoFocus={!band}
          sx={{ mt: 1 }}
          slotProps={{
            htmlInput: { inputMode: 'decimal' },
            input: { endAdornment: <InputAdornment position="end">kg</InputAdornment> },
          }}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, mb: 1 }}>
          Couleur
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 1.25, justifyItems: 'center' }}>
          {BAND_PALETTE.map((p) => {
            const on = color.toUpperCase() === p.hex.toUpperCase()
            return (
              <Box
                key={p.hex}
                component="button"
                type="button"
                aria-label={p.name}
                onClick={() => pick(p.hex)}
                sx={{
                  width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  bgcolor: p.hex, color: textOnColor(p.hex),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: on ? (t) => `0 0 0 2px ${t.palette.background.paper}, 0 0 0 4px ${t.palette.primary.main}` : 'inset 0 0 0 1px rgba(0,0,0,0.08)',
                }}
              >
                {on && <Check sx={{ fontSize: 18 }} />}
              </Box>
            )
          })}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2 }}>
          <TextField
            label="Couleur hex"
            value={hexInput}
            onChange={(e) => onHexChange(e.target.value.trim())}
            error={!isHexColor(hexInput)}
            size="small"
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { maxLength: 7, autoCapitalize: 'characters', spellCheck: false } }}
          />
          <BandChip kg={kg > 0 ? kg : 0} color={color} />
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} color="inherit">Annuler</Button>
        <Button onClick={save} disabled={!valid || saving || disabled} variant="contained">
          {saving ? <CircularProgress size={18} color="inherit" /> : 'Enregistrer'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default BandDialog
