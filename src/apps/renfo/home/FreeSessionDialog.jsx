import { useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import { FREE_KINDS, KIND_LABELS } from '../../../../supabase/functions/_shared/strength/rules.ts'

/**
 * Séance libre : choix du type, puis génération synchrone (jusqu'à 30 s environ).
 * `onCreate(kind)` renvoie la séance créée ou lève une erreur lisible.
 */
const FreeSessionDialog = ({ open, online, onClose, onCreate }) => {
  const [kind, setKind] = useState(FREE_KINDS[0])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setPending(false)
      setError(null)
    }
  }

  const create = async () => {
    setPending(true)
    setError(null)
    try {
      await onCreate(kind)
    } catch (e) {
      setError(e.message)
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => !pending && onClose()}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Séance libre</DialogTitle>
      <DialogContent>
        {pending ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={32} />
            <Typography variant="body2" fontWeight={600} sx={{ mt: 2 }}>Préparation de ta séance</Typography>
            <Typography variant="caption" color="text.secondary">
              Cela peut prendre jusqu'à 30 secondes, reste sur cet écran.
            </Typography>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Une séance hors cycle, ajoutée à cette semaine.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {FREE_KINDS.map((k) => {
                const on = k === kind
                return (
                  <Box
                    key={k}
                    onClick={() => setKind(k)}
                    sx={{
                      px: 2, py: 1.25, borderRadius: '14px', cursor: 'pointer', fontWeight: 600,
                      border: '1px solid', borderColor: on ? 'primary.main' : 'divider',
                      color: on ? 'primary.main' : 'text.primary',
                    }}
                  >
                    {KIND_LABELS[k]}
                  </Box>
                )
              })}
            </Box>
            {!online && <Alert severity="info" sx={{ mt: 2 }}>Hors ligne : la création demande le réseau.</Alert>}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={pending} color="inherit">Annuler</Button>
        <Button onClick={create} disabled={pending || !online} variant="contained">Créer la séance</Button>
      </DialogActions>
    </Dialog>
  )
}

export default FreeSessionDialog
