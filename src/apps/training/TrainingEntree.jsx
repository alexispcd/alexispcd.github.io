import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import PageEchecChargement from '../../components/PageEchecChargement'
import BarreAttente from '../../ui/BarreAttente'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
import { getCurrentPlan, getPlans } from '../../lib/training'
import PlanDashboard from './dashboard/PlanDashboard'
import TrainingHome from './TrainingHome'

// Lecture de l'entrée : le plan courant complet, puis les plans passés seulement
// s'il n'y a pas de plan courant.
const charger = async () => {
  const plan = await getCurrentPlan()
  if (plan) return { plan, plans: null }
  return { plan: null, plans: await getPlans() }
}

/**
 * Route /training (lot T1b) : une seule lecture et une seule barre, sans redirection.
 * - Plan courant (en cours, en génération ou en échec) : le dashboard sur place.
 * - Aucun plan : l'écran de TrainingHome avec les plans passés déjà lus.
 * - ?view=history : TrainingHome, qui charge ses données lui-même (jusqu'à T3).
 * Pas d'actions de barre du haut ici : chaque enfant pose les siennes.
 */
const TrainingEntree = () => {
  const [searchParams] = useSearchParams()
  const historique = searchParams.get('view') === 'history'

  // statut : 'chargement', 'pret' ou 'echec' ; essai relance la lecture.
  const [etat, setEtat] = useState({ statut: 'chargement', plan: null, plans: null, essai: 0 })
  // Retour de ?view=history vers /training (même route, composant gardé) : relecture
  // complète plutôt que l'ancien plan. Ajustement au rendu, l'effet relit ensuite.
  const [historiqueAvant, setHistoriqueAvant] = useState(historique)
  if (historique !== historiqueAvant) {
    setHistoriqueAvant(historique)
    if (!historique) setEtat((e) => ({ ...e, statut: 'chargement', plan: null, plans: null }))
  }
  const attente = useFinAttente(etat.statut === 'chargement')

  useEffect(() => {
    if (historique) return undefined
    let annule = false
    charger()
      .then(({ plan, plans }) => {
        if (!annule) setEtat((e) => ({ ...e, statut: 'pret', plan, plans }))
      })
      .catch((err) => {
        console.error('[TrainingEntree] chargement :', err)
        if (!annule) setEtat((e) => ({ ...e, statut: 'echec' }))
      })
    return () => { annule = true }
  }, [historique, etat.essai])

  // Remet l'entrée en chargement et relit tout : le dashboard ou l'écran sans plan
  // sont démontés, sans état périmé (plan archivé, plan en échec supprimé).
  const relancer = () => setEtat((e) => ({ statut: 'chargement', plan: null, plans: null, essai: e.essai + 1 }))

  if (historique) return <TrainingHome />

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }

  if (etat.statut === 'echec') {
    return <PageEchecChargement titre="Impossible de charger Training" onReessayer={relancer} />
  }

  if (etat.plan) return <PlanDashboard planInitial={etat.plan} onPlanQuitte={relancer} />
  return <TrainingHome plansInitiaux={etat.plans ?? []} />
}

export default TrainingEntree
