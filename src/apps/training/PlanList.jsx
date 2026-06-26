import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Chip, CircularProgress, IconButton, Menu, MenuItem,
  Button, Fab, Dialog, DialogTitle, DialogContentText, DialogActions,
  Alert, ListItemIcon,
} from '@mui/material'
import {
  MoreVert, Add, EmojiEvents, Schedule, Archive, DeleteForever, DirectionsRun,
} from '@mui/icons-material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { getAllPlans, archivePlan, deletePlan } from '../../lib/training'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'

const DIALOG_PAPER = {
  sx: { ...glassSx, borderRadius: 3, mx: 2, maxWidth: 360, width: 'calc(100% - 32px)' },
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function weeksToRace(dateStr) {
  if (!dateStr) return null
  const weeks = Math.ceil((new Date(dateStr) - new Date()) / (7 * 24 * 3600 * 1000))
  return weeks > 0 ? weeks : null
}

// ── Carte plan actif (mise en avant) ────────────────────────────────────────
const ActivePlanCard = ({ plan, onTap, onMenu }) => {
  const weeks = weeksToRace(plan.race_date)
  return (
    <Box
      onClick={onTap}
      sx={{
        p: 2.5, borderRadius: 3, cursor: 'pointer', position: 'relative',
        border: '1.5px solid', borderColor: 'primary.main',
        bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(29,158,117,0.06)' : 'rgba(29,158,117,0.04)',
        transition: 'opacity 0.15s',
        '&:active': { opacity: 0.75 },
      }}
    >
      <IconButton
        size="small"
        onClick={onMenu}
        sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }}
      >
        <MoreVert fontSize="small" />
      </IconButton>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.25 }}>
        <EmojiEvents sx={{ fontSize: 14, color: 'primary.main' }} />
        <Typography variant="overline" color="primary"
          sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', lineHeight: 1 }}>
          Plan actif
        </Typography>
      </Box>

      <Typography variant="h6" fontWeight={700} sx={{ mb: 1.5, pr: 5 }}>
        {plan.race_name ?? 'Plan en cours'}
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {plan.race_distance && (
          <Chip label={plan.race_distance} size="small" variant="outlined"
            sx={{ height: 22, fontSize: '0.72rem' }} />
        )}
        {plan.race_date && (
          <Chip label={formatDate(plan.race_date)} size="small" variant="outlined"
            sx={{ height: 22, fontSize: '0.72rem' }} />
        )}
        {weeks != null && (
          <Chip
            icon={<Schedule sx={{ fontSize: '12px !important' }} />}
            label={`${weeks} sem. restante${weeks > 1 ? 's' : ''}`}
            size="small" color="primary" variant="outlined"
            sx={{ height: 22, fontSize: '0.72rem' }}
          />
        )}
        {plan.target_time && (
          <Chip
            label={`Objectif ${plan.target_time}`}
            size="small" color="primary"
            sx={{ height: 22, fontSize: '0.72rem' }}
          />
        )}
      </Box>
    </Box>
  )
}

// ── Carte plan archivé/terminé (compact) ────────────────────────────────────
const STATUS_LABEL = { archived: 'Archivé', completed: 'Terminé' }

const PastPlanCard = ({ plan, onTap, onMenu }) => (
  <Box
    onClick={onTap}
    sx={{
      px: 2, py: 1.5, borderRadius: 2, cursor: 'pointer',
      border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper',
      display: 'flex', alignItems: 'center', gap: 1.5,
      transition: 'opacity 0.15s', '&:active': { opacity: 0.6 },
    }}
  >
    <EmojiEvents sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }} />

    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600} noWrap>
        {plan.race_name ?? 'Plan sans nom'}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        {[plan.race_distance, plan.race_date && formatDate(plan.race_date)].filter(Boolean).join(' · ')}
      </Typography>
    </Box>

    <Chip
      label={STATUS_LABEL[plan.status] ?? plan.status}
      size="small"
      sx={{ height: 20, fontSize: '0.62rem', '& .MuiChip-label': { px: 0.75 }, flexShrink: 0 }}
    />

    <IconButton size="small" onClick={onMenu} sx={{ color: 'text.disabled', flexShrink: 0, mr: -0.5 }}>
      <MoreVert fontSize="small" />
    </IconButton>
  </Box>
)

// ── Composant principal ──────────────────────────────────────────────────────
const PlanList = ({ onSelectPlan, onNewPlan }) => {
  const [plans, setPlans] = useState(null)
  const [menuState, setMenuState] = useState(null) // { anchorEl, plan }
  const [pendingAction, setPendingAction] = useState(null) // { type: 'archive'|'delete', plan }
  const [actionLoading, setActionLoading] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await getAllPlans()
      setPlans(data)
    } catch (err) {
      console.error('[PlanList] load error:', err.message)
      setPlans([])
    }
  }, [])

  useEffect(() => {
    setPlans(null)
    load()
  }, [load])

  const activePlan = plans?.find(p => p.status === 'active') ?? null
  const pastPlans  = plans?.filter(p => p.status !== 'active') ?? []
  const loading    = plans === null

  const openMenu  = (e, plan) => { e.stopPropagation(); setMenuState({ anchorEl: e.currentTarget, plan }) }
  const closeMenu = () => setMenuState(null)

  const handleArchiveConfirm = async () => {
    setActionLoading(true)
    try {
      await archivePlan(pendingAction.plan.id)
      await load()
    } catch (err) {
      console.error('[PlanList] archivePlan error:', err.message)
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  const handleDeleteConfirm = async () => {
    setActionLoading(true)
    try {
      await deletePlan(pendingAction.plan.id)
      await load()
    } catch (err) {
      console.error('[PlanList] deletePlan error:', err.message)
    } finally {
      setActionLoading(false)
      setPendingAction(null)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', pt: `${HEADER_HEIGHT}px` }}>

      {/* Contenu scrollable */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2, pb: '96px' }}>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && plans.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 8, textAlign: 'center' }}>
            <DirectionsRun sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Box>
              <Typography variant="body1" fontWeight={600} gutterBottom>
                Aucun plan pour l'instant
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Crée ton premier plan pour commencer à suivre ton entraînement.
              </Typography>
            </Box>
            <Button variant="contained" disableElevation onClick={onNewPlan} startIcon={<Add />}>
              Créer mon premier plan
            </Button>
          </Box>
        )}

        {/* Plan actif */}
        {!loading && activePlan && (
          <Box sx={{ mt: 2.5, mb: 3 }}>
            <Typography variant="overline" color="text.secondary"
              sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', display: 'block', mb: 1.25 }}>
              Plan actif
            </Typography>
            <ActivePlanCard
              plan={activePlan}
              onTap={() => onSelectPlan(activePlan)}
              onMenu={(e) => openMenu(e, activePlan)}
            />
          </Box>
        )}

        {/* Historique */}
        {!loading && pastPlans.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary"
              sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', display: 'block', mb: 1.25 }}>
              Historique
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {pastPlans.map(plan => (
                <PastPlanCard
                  key={plan.id}
                  plan={plan}
                  onTap={() => onSelectPlan(plan)}
                  onMenu={(e) => openMenu(e, plan)}
                />
              ))}
            </Box>
          </Box>
        )}

      </Box>

      {/* FAB Nouveau plan */}
      {!loading && (
        <Fab color="primary" onClick={onNewPlan}
          sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
          <Add />
        </Fab>
      )}

      {/* Menu contextuel */}
      <Menu
        anchorEl={menuState?.anchorEl}
        open={Boolean(menuState)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {menuState?.plan.status === 'active' && (
          <MenuItem onClick={() => { closeMenu(); setPendingAction({ type: 'archive', plan: menuState.plan }) }}>
            <ListItemIcon><Archive fontSize="small" /></ListItemIcon>
            Archiver
          </MenuItem>
        )}
        <MenuItem
          onClick={() => { closeMenu(); setPendingAction({ type: 'delete', plan: menuState.plan }) }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteForever fontSize="small" color="error" /></ListItemIcon>
          Supprimer définitivement
        </MenuItem>
      </Menu>

      {/* Popup : Archiver */}
      <Dialog
        open={pendingAction?.type === 'archive'}
        onClose={() => !actionLoading && setPendingAction(null)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Archiver ce plan ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          Le plan <strong>{pendingAction?.plan.race_name ?? 'sans nom'}</strong> sera archivé et ne sera plus le plan actif.
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setPendingAction(null)} disabled={actionLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="contained" disableElevation onClick={handleArchiveConfirm}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <Archive />}>
            {actionLoading ? 'Archivage...' : 'Archiver'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Popup : Supprimer */}
      <Dialog
        open={pendingAction?.type === 'delete'}
        onClose={() => !actionLoading && setPendingAction(null)}
        PaperProps={DIALOG_PAPER}
        BackdropProps={GLASS_BACKDROP}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700, fontSize: '1rem' }}>
          Supprimer définitivement ?
        </DialogTitle>
        <DialogContentText sx={{ px: 3, pb: 2, fontSize: '0.875rem', color: 'text.secondary' }}>
          Le plan <strong>{pendingAction?.plan.race_name ?? 'sans nom'}</strong> et toutes ses séances seront supprimés. Cette action est irréversible.
        </DialogContentText>
        <DialogActions sx={{ px: 2, pb: 2.5, gap: 1 }}>
          <Button fullWidth onClick={() => setPendingAction(null)} disabled={actionLoading}
            sx={{ color: 'text.secondary' }}>
            Annuler
          </Button>
          <Button fullWidth variant="contained" disableElevation color="error" onClick={handleDeleteConfirm}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteForever />}>
            {actionLoading ? 'Suppression...' : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

export default PlanList
