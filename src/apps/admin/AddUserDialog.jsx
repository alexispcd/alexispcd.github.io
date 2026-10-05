import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  FormControlLabel, Checkbox, Box, Typography, CircularProgress,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'
import { assignableModules } from '../registry'

const DEFAULT_MODULES = ['training', 'cotes']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const AddUserDialog = ({ open, busy, onClose, onCreate }) => {
  const [email, setEmail] = useState('')
  const [modules, setModules] = useState(DEFAULT_MODULES)
  const valid = EMAIL_RE.test(email.trim())

  const reset = () => {
    setEmail('')
    setModules(DEFAULT_MODULES)
  }

  const submit = async () => {
    if (!valid || busy) return
    if (await onCreate(email.trim(), modules)) reset()
  }

  const toggle = (id, checked) =>
    setModules(prev => checked ? [...prev, id] : prev.filter(m => m !== id))

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ pb: 1 }}>Ajouter un compte</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Adresse email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            disabled={busy}
            size="small"
            fullWidth
            autoFocus
            autoComplete="off"
          />
          <Box>
            <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem' }}>
              Modules
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {assignableModules().map(m => (
                <FormControlLabel
                  key={m.id}
                  control={(
                    <Checkbox
                      checked={modules.includes(m.id)}
                      onChange={e => toggle(m.id, e.target.checked)}
                      disabled={busy}
                      size="small"
                    />
                  )}
                  label={<Typography variant="body2">{m.name}</Typography>}
                />
              ))}
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary">
            La personne se connecte ensuite avec un code reçu par email.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit" disabled={busy}>Annuler</Button>
        <Button onClick={submit} variant="contained" disabled={!valid || busy} sx={{ textTransform: 'none' }}>
          {busy ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'Créer le compte'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default AddUserDialog
