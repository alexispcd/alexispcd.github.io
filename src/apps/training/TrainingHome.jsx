import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box, Typography, Button, IconButton, CircularProgress, Alert,
  Menu, MenuItem, ListItemIcon, ListItemText,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material'
import Terrain from '@mui/icons-material/Terrain'
import EmojiEvents from '@mui/icons-material/EmojiEvents'
import MilitaryTech from '@mui/icons-material/MilitaryTech'
import MoreVert from '@mui/icons-material/MoreVert'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { glassSx, cardSx, GLASS_BACKDROP } from '../../styles/glass'
import { getActivePlan, getPlans, deletePlan } from '../../lib/training'
import {
  PLAN_STATUS_LABEL, raceDistanceLabel, formatGoalTime,
} from './constants'

// Radius unifié des cartes de la liste des plans (hero actif/vide + plans passés).
const PLAN_CARD_RADIUS = 4

const formatEndDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

const TrainingHome = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const historyView = searchParams.get('view') === 'history'

  const [activePlan, setActivePlan] = useState(undefined) // undefined = chargement
  const [plans, setPlans] = useState([])
  const [error, setError] = useState(null)

  const [menuAnchor, setMenuAnchor] = useState(null)
  const [menuPlan, setMenuPlan] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([getActivePlan(), getPlans()])
      .then(([active, past]) => {
        if (cancelled) return
        setActivePlan(active ?? null)
        setPlans(past)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message)
        setActivePlan(null)
      })
    return () => { cancelled = true }
  }, [])

  const openMenu = (e, plan) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
    setMenuPlan(plan)
  }
  const closeMenu = () => { setMenuAnchor(null); setMenuPlan(null) }

  const askDelete = () => {
    setConfirmDelete(menuPlan)
    closeMenu()
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await deletePlan(confirmDelete.id)
      setPlans((prev) => prev.filter((p) => p.id !== confirmDelete.id))
      setConfirmDelete(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  if (activePlan === undefined) {
    return (
      <Box sx={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pt: `${HEADER_HEIGHT}px` }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  // Redirection vers le dashboard si un plan actif exploitable existe.
  if (activePlan && activePlan.generation_status !== 'error' && !historyView) {
    return <Navigate to={`/training/plan/${activePlan.id}`} replace />
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: 6 }}>

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Hero — plan actif à reprendre, ou état vide */}
        {activePlan ? (
          <Box sx={{ ...cardSx, borderRadius: PLAN_CARD_RADIUS, p: 3, mt: 2, textAlign: 'center' }}>
            <Terrain sx={{ fontSize: 38, color: 'primary.main', mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>{activePlan.race_name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5 }}>
              {activePlan.generation_status === 'error'
                ? 'La génération de ce plan a échoué. Ouvre-le pour réessayer ou le supprimer.'
                : 'Un plan est en cours.'}
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate(`/training/plan/${activePlan.id}`)}
            >
              Ouvrir le plan
            </Button>
          </Box>
        ) : (
          <Box sx={{ ...cardSx, borderRadius: PLAN_CARD_RADIUS, p: 3, mt: 2, textAlign: 'center' }}>
            <Terrain sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" fontWeight={700}>Aucun plan actif</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2.5, lineHeight: 1.5 }}>
              Crée un plan d'entraînement adapté à ta prochaine course, généré à partir de ta forme du moment.
            </Typography>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate('/training/wizard')}
            >
              Créer un plan
            </Button>
          </Box>
        )}

        {/* Plans passés */}
        {plans.length > 0 && (
          <>
            <Typography
              variant="overline"
              sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', mt: 4, mb: 1.5, ml: 0.5 }}
            >
              Plans passés
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {plans.map((plan, i) => (
                <Box
                  key={plan.id}
                  sx={{
                    ...cardSx, borderRadius: PLAN_CARD_RADIUS,
                    display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75,
                  }}
                >
                  {i === 0
                    ? <EmojiEvents sx={{ fontSize: 22, color: 'primary.main' }} />
                    : <MilitaryTech sx={{ fontSize: 22, color: 'text.secondary' }} />}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {raceDistanceLabel(plan.race_distance_m)
                        ? `${raceDistanceLabel(plan.race_distance_m)} · ${plan.race_name}`
                        : plan.race_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                      {plan.week_count} semaines · {PLAN_STATUS_LABEL[plan.status]?.toLowerCase() ?? plan.status} le {formatEndDate(plan.race_date)}
                    </Typography>
                  </Box>
                  {plan.goal_time_sec != null && (
                    <Typography
                      variant="caption"
                      sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'text.secondary', flexShrink: 0 }}
                    >
                      {formatGoalTime(plan.goal_time_sec)}
                    </Typography>
                  )}
                  <IconButton size="small" onClick={(e) => openMenu(e, plan)} sx={{ color: 'text.secondary' }}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* Menu contextuel plan passé */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { ...glassSx, minWidth: 180 } }}
      >
        <MenuItem onClick={askDelete}>
          <ListItemIcon><DeleteOutlined fontSize="small" /></ListItemIcon>
          <ListItemText>Supprimer</ListItemText>
        </MenuItem>
      </Menu>

      {/* Confirmation suppression */}
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => !deleting && setConfirmDelete(null)}
        slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Supprimer ce plan ?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            « {confirmDelete?.race_name} » et toutes ses séances seront définitivement supprimés.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(null)} disabled={deleting} color="inherit">
            Annuler
          </Button>
          <Button onClick={doDelete} disabled={deleting} color="error" variant="contained">
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Supprimer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default TrainingHome
