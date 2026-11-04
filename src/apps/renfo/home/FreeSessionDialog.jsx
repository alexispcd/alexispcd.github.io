import { useState } from 'react'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../../styles/glass'
import BarreAttente from '../../../ui/BarreAttente'
import { useFinAttente } from '../../../ui/useFinAttente'
import { DUREES } from '../../../lib/durees'
import { generationErrorMessage } from '../errors'
import { FREE_KINDS, KIND_LABELS } from '../../../../supabase/functions/_shared/strength/rules.ts'

/**
 * Séance libre : choix du type, puis génération synchrone (jusqu'à 30 s environ).
 * `onCreate(kind)` renvoie la séance créée ou lève l'erreur de renfo-session.
 */
const FreeSessionDialog = ({ open, onClose, onCreate }) => {
  const [kind, setKind] = useState(FREE_KINDS[0])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [wasOpen, setWasOpen] = useState(false)
  const attente = useFinAttente(pending)

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
      console.error('[renfo séance libre]', e)
      setError(generationErrorMessage(e))
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
        {attente.visible ? (
          <Box sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box>
              <Typography variant="corps-fort" sx={{ display: 'block' }}>Préparation de ta séance</Typography>
              <Typography variant="secondaire" sx={{ color: 'muted' }}>
                Jusqu'à 30 secondes, reste sur cet écran.
              </Typography>
            </Box>
            <BarreAttente place="section" duree={DUREES.preparationRenfo} {...attente} />
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
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={attente.visible} color="inherit">Annuler</Button>
        <Button onClick={create} disabled={attente.visible} variant="contained">Créer la séance</Button>
      </DialogActions>
    </Dialog>
  )
}

export default FreeSessionDialog
