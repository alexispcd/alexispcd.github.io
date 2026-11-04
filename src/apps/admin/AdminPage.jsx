import { useState, useEffect } from 'react'
import { Box, Typography, Button, Alert } from '@mui/material'
import PersonAdd from '@mui/icons-material/PersonAdd'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { useAppCtx } from '../../lib/context'
import { texteErreur } from '../../lib/reseau'
import { useMessage } from '../../ui/useMessage'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
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
  // Échec de création affiché dans le dialogue : un Message passerait sous son voile.
  const [addError, setAddError] = useState(null)
  const { afficher } = useMessage()
  const attente = useFinAttente(state.status === 'loading')
  const suppression = useAction({
    attente: 'Suppression du compte', duree: DUREES.administration,
    succes: 'Compte supprimé', echec: 'Le compte n\'a pas pu être supprimé. Réessaie.',
  })

  useEffect(() => {
    let cancelled = false
    fetchUsers().then(
      (res) => { if (!cancelled) setState({ status: 'ready', ...res }) },
      (err) => {
        console.error('[admin] chargement des comptes :', err)
        if (!cancelled) setState({ status: 'error', users: [], now: 0 })
      },
    )
    return () => { cancelled = true }
  }, [])

  const selected = state.users.find(u => u.id === selectedId) ?? null

  const updateUser = (id, patch) => setState(s => ({
    ...s,
    users: s.users.map(u => u.id === id ? { ...u, ...patch } : u),
  }))

  // Exécute une action admin : verrou, Message de succès ou d'échec. `succes` : texte,
  // ou fonction du résultat de l'action. Renvoie true si réussie.
  const run = async (action, succes, echec) => {
    setBusy(true)
    try {
      const res = await action()
      afficher(typeof succes === 'function' ? succes(res) : succes)
      return true
    } catch (err) {
      afficher(texteErreur(err, echec))
      return false
    } finally {
      setBusy(false)
    }
  }

  const reload = async () => {
    const res = await fetchUsers()
    setState({ status: 'ready', ...res })
  }

  const handleCreate = async (email, mods) => {
    setBusy(true)
    setAddError(null)
    try {
      await createUser(email, mods)
    } catch (err) {
      const phrase = err?.status === 409
        ? 'Un compte existe déjà avec cet e-mail.'
        : 'Le compte n\'a pas pu être créé. Réessaie.'
      setAddError(texteErreur(err, phrase))
      setBusy(false)
      return false
    }
    // Compte créé : un échec du rechargement de la liste ne change pas ce résultat.
    try {
      await reload()
    } catch (err) {
      console.error('[admin] rechargement des comptes :', err)
    }
    setAddOpen(false)
    setBusy(false)
    afficher(`Compte ${email} créé`)
    return true
  }

  const openAdd = () => {
    setAddError(null)
    setAddOpen(true)
  }

  const handleSetModules = (mods) => run(async () => {
    const res = await setUserModules(selected.id, mods)
    updateUser(selected.id, { modules: res.modules })
    // Ses propres droits : l'accès courant (home, routes) suit immédiatement.
    if (selected.id === user?.id) {
      try {
        await refreshAccess()
      } catch (err) {
        console.error('refreshAccess error:', err)
        return { aRecharger: true }
      }
    }
    return {}
  }, (r) => (r.aRecharger ? 'Modules enregistrés. Recharge pour les appliquer.' : 'Modules enregistrés'),
  'Les modules n\'ont pas pu être enregistrés. Réessaie.')

  const handleToggleDisabled = () => {
    const disable = !selected.disabled
    return run(async () => {
      await (disable ? disableUser(selected.id) : enableUser(selected.id))
      updateUser(selected.id, { disabled: disable })
    }, disable ? 'Compte désactivé' : 'Compte réactivé',
    disable ? 'Le compte n\'a pas pu être désactivé. Réessaie.' : 'Le compte n\'a pas pu être réactivé. Réessaie.')
  }

  // La fiche se ferme tout de suite ; l'attente se montre en carte en tête de page.
  const handleDelete = () => {
    const { id } = selected
    setSelectedId(null)
    return suppression.lancer(async () => {
      await deleteUser(id)
      setState(s => ({ ...s, users: s.users.filter(u => u.id !== id) }))
    })
  }

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, pt: `${HEADER_HEIGHT + 16}px`, pb: 6 }}>
        <BarreAttente place="carte" {...suppression.barre} sx={{ '& .MuiCollapse-wrapperInner': { pb: 2 } }} />


        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 0.5 }}>
          <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem' }}>
            Comptes{state.status === 'ready' ? ` (${state.users.length})` : ''}
          </Typography>
          <Button
            size="small"
            variant="contained"
            startIcon={<PersonAdd fontSize="small" />}
            onClick={openAdd}
            disabled={state.status !== 'ready' || suppression.enCours}
            sx={{ textTransform: 'none' }}
          >
            Ajouter
          </Button>
        </Box>

        {state.status === 'error' && (
          <Alert severity="error" sx={{ borderRadius: '12px' }}>
            Impossible de charger les comptes.
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
        erreur={addError}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
      />
    </Box>
  )
}

export default AdminPage
