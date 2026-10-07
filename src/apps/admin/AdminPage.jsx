import { useState, useEffect } from 'react'
import { Box, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material'
import PersonAdd from '@mui/icons-material/PersonAdd'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { useAppCtx } from '../../lib/context'
import {
  listUsers, createUser, setUserModules, disableUser, enableUser, deleteUser,
} from '../../lib/admin'
import { modules } from '../registry'
import UserListItem from './UserListItem'
import UserDrawer from './UserDrawer'
import AddUserDialog from './AddUserDialog'

// Chargement hors composant : l'effet ne fait que poser le résultat dans le .then().
// `now` est figé au chargement pour les dates relatives (pas de Date.now() au rendu).
const fetchUsers = async () => ({ users: await listUsers(), now: Date.now() })

const moduleName = (id) => modules.find(m => m.id === id)?.name ?? id

const AdminPage = () => {
  const { user, refreshAccess } = useAppCtx()
  const [state, setState] = useState({ status: 'loading', users: [], now: 0 })
  const [selectedId, setSelectedId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [snack, setSnack] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchUsers().then(
      (res) => { if (!cancelled) setState({ status: 'ready', ...res }) },
      (err) => { if (!cancelled) setState({ status: 'error', users: [], now: 0, message: err.message }) },
    )
    return () => { cancelled = true }
  }, [])

  const selected = state.users.find(u => u.id === selectedId) ?? null

  const updateUser = (id, patch) => setState(s => ({
    ...s,
    users: s.users.map(u => u.id === id ? { ...u, ...patch } : u),
  }))

  // Exécute une action admin : verrou, Snackbar de succès ou d'erreur. Renvoie true si réussie.
  const run = async (action, successMessage) => {
    setBusy(true)
    try {
      await action()
      setSnack({ severity: 'success', message: successMessage })
      return true
    } catch (err) {
      setSnack({ severity: 'error', message: err.message })
      return false
    } finally {
      setBusy(false)
    }
  }

  const reload = async () => {
    const res = await fetchUsers()
    setState({ status: 'ready', ...res })
  }

  const handleCreate = (email, mods) => run(async () => {
    await createUser(email, mods)
    await reload()
    setAddOpen(false)
  }, `Compte ${email} créé`)

  const handleSetModules = (mods) => run(async () => {
    const res = await setUserModules(selected.id, mods)
    updateUser(selected.id, { modules: res.modules })
    // Ses propres droits : l'accès courant (home, routes) suit immédiatement.
    if (selected.id === user?.id) {
      try {
        await refreshAccess()
      } catch (err) {
        console.error('refreshAccess error:', err)
        throw new Error('Droits mis à jour, recharge la page pour les appliquer', { cause: err })
      }
    }
  }, 'Droits mis à jour')

  const handleToggleDisabled = () => {
    const disable = !selected.disabled
    return run(async () => {
      await (disable ? disableUser(selected.id) : enableUser(selected.id))
      updateUser(selected.id, { disabled: disable })
    }, disable ? 'Compte désactivé' : 'Compte réactivé')
  }

  const handleDelete = () => {
    const { id, email } = selected
    return run(async () => {
      await deleteUser(id)
      setSelectedId(null)
      setState(s => ({ ...s, users: s.users.filter(u => u.id !== id) }))
    }, `Compte ${email} supprimé`)
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, pt: `${HEADER_HEIGHT + 16}px`, pb: 6 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem' }}>
            Comptes{state.status === 'ready' ? ` (${state.users.length})` : ''}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<PersonAdd fontSize="small" />}
            onClick={() => setAddOpen(true)}
            disabled={state.status !== 'ready'}
            sx={{ textTransform: 'none' }}
          >
            Ajouter
          </Button>
        </Box>

        {state.status === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {state.status === 'error' && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            Impossible de charger les comptes : {state.message}
          </Alert>
        )}

        {state.status === 'ready' && state.users.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
            Aucun compte pour l'instant.
          </Typography>
        )}

        {state.status === 'ready' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {state.users.map(account => (
              <UserListItem
                key={account.id}
                account={account}
                isSelf={account.id === user?.id}
                now={state.now}
                moduleName={moduleName}
                onClick={() => setSelectedId(account.id)}
              />
            ))}
          </Box>
        )}
      </Box>

      <UserDrawer
        account={selected}
        busy={busy}
        onClose={() => setSelectedId(null)}
        onSetModules={handleSetModules}
        onToggleDisabled={handleToggleDisabled}
        onDelete={handleDelete}
      />

      <AddUserDialog
        open={addOpen}
        busy={busy}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
      />

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default AdminPage
