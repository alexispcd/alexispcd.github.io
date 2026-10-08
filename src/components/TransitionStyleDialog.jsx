// Réglage de test, à retirer une fois le style choisi.
import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  RadioGroup, FormControlLabel, Radio,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../styles/glass'
import { VT_STYLES, readTransitionStyle, saveTransitionStyle } from '../lib/viewTransition'

const TransitionStyleDialog = ({ open, onClose }) => {
  const [style, setStyle] = useState(readTransitionStyle)

  const handleChange = (e) => {
    setStyle(e.target.value)
    saveTransitionStyle(e.target.value)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600 }}>Transitions</DialogTitle>
      <DialogContent sx={{ pb: 0 }}>
        <RadioGroup value={style} onChange={handleChange}>
          {VT_STYLES.map(s => (
            <FormControlLabel key={s.id} value={s.id} control={<Radio size="small" />} label={s.label} />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Fermer</Button>
      </DialogActions>
    </Dialog>
  )
}

export default TransitionStyleDialog
