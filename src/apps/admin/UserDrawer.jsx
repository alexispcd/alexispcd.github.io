import { useState } from 'react'
import {
  Drawer, Box, Typography, Switch, Button, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, CircularProgress,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'
import { assignableModules } from '../registry'

const UserDrawer = ({ account, busy, onClose, onSetModules, onToggleDisabled, onDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isAdminAccount = account?.role === 'admin'

  const toggleModule = (moduleId, checked) => {
    const next = checked
      ? [...account.modules, moduleId]
      : account.modules.filter(id => id !== moduleId)
    onSetModules(next)
  }

  const closeAll = () => {
    setConfirmDelete(false)
    onClose()
  }

  return (
    <>
      <Drawer
        anchor="bottom"
        open={Boolean(account)}
        onClose={() => !busy && closeAll()}
        slotProps={{
          backdrop: GLASS_BACKDROP,
          paper: {
            sx: {
              ...glassSx,
              borderRadius: '20px 20px 0 0',
              px: 3,
              pt: 3,
              pb: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))',
            },
          },
        }}
      >
        {account && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="body1" fontWeight={600} noWrap sx={{ flex: 1, minWidth: 0 }}>
                {account.email}
              </Typography>
              {busy && <CircularProgress size={18} />}
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem' }}>
                Modules
              </Typography>
              {assignableModules().map(m => {
                const Icon = m.icon
                return (
                  <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                    <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{m.name}</Typography>
                    <Switch
                      checked={account.modules.includes(m.id)}
                      disabled={busy}
                      onChange={(e) => toggleModule(m.id, e.target.checked)}
                    />
                  </Box>
                )
              })}
            </Box>

            <Divider />

            {isAdminAccount ? (
              <Typography variant="body2" color="text.secondary">
                Compte administrateur : ni désactivation ni suppression.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={busy}
                  onClick={onToggleDisabled}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  {account.disabled ? 'Réactiver' : 'Désactiver'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  Supprimer
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      <Dialog
        open={confirmDelete}
        onClose={() => !busy && setConfirmDelete(false)}
        fullWidth
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ pb: 1 }}>Supprimer ce compte ?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Le compte {account?.email} et toutes ses données (plans, séances, connexion Coros, préférences)
            seront définitivement effacés.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmDelete(false)} color="inherit" disabled={busy}>Annuler</Button>
          <Button
            onClick={async () => { if (await onDelete()) closeAll() }}
            color="error"
            variant="contained"
            disabled={busy}
          >
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UserDrawer
