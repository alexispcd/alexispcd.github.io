import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import {
  Box, Typography, Button, IconButton, Alert,
  Menu, MenuItem, ListItemIcon, ListItemText,
} from '@mui/material'
import Terrain from '@mui/icons-material/Terrain'
import EmojiEvents from '@mui/icons-material/EmojiEvents'
import MilitaryTech from '@mui/icons-material/MilitaryTech'
import MoreVert from '@mui/icons-material/MoreVert'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { glassSx, cardSx } from '../../styles/glass'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
import { getActivePlan, getPlans, deletePlan, countUpcomingOnWatch } from '../../lib/training'
import { useAppCtx } from '../../lib/context'
import {
  PLAN_STATUS_LABEL, raceDistanceLabel, formatGoalTime, onWatchWarning,
} from './constants'

// Radius unifié des cartes de la liste des plans (hero actif/vide + plans passés).
const PLAN_CARD_RADIUS = 4

const formatEndDate = (d) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

/**
 * Écran Training sans dashboard : plan en cours à rouvrir (vue ?view=history) ou état
 * vide, puis plans passés.
 * - plansInitiaux : plans passés déjà lus par TrainingEntree quand il n'y a aucun plan
 *   courant ; rien n'est chargé, aucune barre. Sans elle, chargement de l'écran.
 */
const TrainingHome = ({ plansInitiaux }) => {
  const navigate = useAppNavigate()
  const { setHeaderActions } = useAppCtx()
  const location = useLocation()

  // undefined = chargement
  const [activePlan, setActivePlan] = useState(plansInitiaux ? null : undefined)
  const [plans, setPlans] = useState(plansInitiaux ?? [])
  const [error, setError] = useState(null)

  const [menuAnchor, setMenuAnchor] = useState(null)
  const [menuPlan, setMenuPlan] = useState(null)
  // Plan visé par la suppression : reste posé pendant la fermeture de la feuille.
  const [suppressionCible, setSuppressionCible] = useState(null)
  const [suppressionOuverte, setSuppressionOuverte] = useState(false)
  const suppression = useAction({
    attente: 'Suppression du plan', duree: DUREES.actionCourte,
    echec: 'Le plan n\'a pas pu être supprimé. Réessaie.',
  })
  const attente = useFinAttente(activePlan === undefined)
  // Séances envoyées sur la montre que la suppression du plan y laissera.
  const [deleteOnWatch, setDeleteOnWatch] = useState({ planId: null, count: 0 })

  const dejaLu = Boolean(plansInitiaux)
  useEffect(() => {
    if (dejaLu) return undefined
    let cancelled = false
    Promise.all([getActivePlan(), getPlans()])
      .then(([active, past]) => {
        if (cancelled) return
        setActivePlan(active ?? null)
        setPlans(past)
      })
      .catch((err) => {
        console.error('[TrainingHome] chargement :', err)
        if (cancelled) return
        setError('Les données n\'ont pas pu être chargées.')
        setActivePlan(null)
      })
    return () => { cancelled = true }
  }, [dejaLu])

  // ── Actions du header ─────────────────────────────────────────────────────
  useEffect(() => {
    setHeaderActions([
      { label: 'Historique des séances', onClick: () => navigate('/historique', { direction: 'forward', state: { retour: `${location.pathname}${location.search}` } }) },
      // Jusqu'au lot Src2.
      { label: 'Réglages', onClick: () => navigate('/training/settings') },
    ], 'Training')
    return () => setHeaderActions([])
  }, [navigate, setHeaderActions, location.pathname, location.search])

  const deleteId = suppressionCible?.id ?? null
  useEffect(() => {
    if (!deleteId) return
    let cancelled = false
    countUpcomingOnWatch(deleteId)
      .then((count) => { if (!cancelled) setDeleteOnWatch({ planId: deleteId, count }) })
      .catch((e) => console.error('[TrainingHome]', e.message))
    return () => { cancelled = true }
  }, [deleteId])
  const onWatchCount = deleteOnWatch.planId === deleteId ? deleteOnWatch.count : 0

  const openMenu = (e, plan) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
    setMenuPlan(plan)
  }
  const closeMenu = () => { setMenuAnchor(null); setMenuPlan(null) }

  const askDelete = () => {
    setSuppressionCible(menuPlan)
    setSuppressionOuverte(true)
    closeMenu()
  }

  const doDelete = async () => {
    const id = suppressionCible?.id
    if (!id) return
    const { ok } = await suppression.lancer(() => deletePlan(id))
    if (ok) setPlans((prev) => prev.filter((p) => p.id !== id))
  }

  // ── Chargement ────────────────────────────────────────────────────────────
  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'env(safe-area-inset-bottom, 0px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        <BarreAttente
          place="carte"
          {...suppression.barre}
          sx={{ '& .MuiCollapse-wrapperInner': { pt: 2 } }}
        />

        {error && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {/* Hero : plan actif à reprendre, ou état vide */}
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
      <FeuilleFlottante
        ouverte={suppressionOuverte}
        onFermer={() => setSuppressionOuverte(false)}
        titre={`${suppressionCible?.race_name ?? ''} et toutes ses séances seront supprimés, séances faites comprises.`
          + (onWatchCount > 0 ? ` ${onWatchWarning(onWatchCount)}` : '')}
        lignes={[{ libelle: 'Supprimer le plan', onClick: doDelete }]}
        fermerLibelle="Annuler"
      />
    </Box>
  )
}

export default TrainingHome
