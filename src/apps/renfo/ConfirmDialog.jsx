import {
  Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'

// Confirmation d'une action destructive du module Renfo.
const ConfirmDialog = ({ open, title, text, confirmLabel, busy = false, disabled = false, onCancel, onConfirm }) => (
  <Dialog
    open={open}
    onClose={() => !busy && onCancel()}
    slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
  >
    <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
    {text && (
      <DialogContent>
        <DialogContentText>{text}</DialogContentText>
      </DialogContent>
    )}
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onCancel} disabled={busy} color="inherit">Annuler</Button>
      <Button onClick={onConfirm} disabled={busy || disabled} color="error" variant="contained">
        {busy ? <CircularProgress size={18} color="inherit" /> : confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
)

export default ConfirmDialog
