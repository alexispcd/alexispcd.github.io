import { useEffect, useState } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import CarteSysteme from '../../components/CarteSysteme'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { DUREES } from '../../lib/durees'
import { getAujourdhui } from '../../lib/training'
import { getBands, getDoneSessions, getPendingSession, getProfile } from '../../lib/renfo'
import { space } from '../../styles/tokens'
import BarreAttente from '../../ui/BarreAttente'
import { ChevronDroit } from '../../ui/Icones'
import WidgetSeance from '../../ui/WidgetSeance'
import { WIDGET_SX } from '../../ui/widget'
import WidgetSemaine from '../../ui/WidgetSemaine'
import { useFinAttente } from '../../ui/useFinAttente'
import { todayISO } from '../training/constants'
import { suggestionDe } from '../renfo/suggestion'
import BandeRenfo from './BandeRenfo'
import { bandeRenfo, vueCourse } from './aujourdhui'
import EnTeteAujourdhui from './EnTeteAujourdhui'

// Dernières données lues, gardées le temps de la session de l'app : revenir sur
// l'Accueil les montre tout de suite, puis les relit sans barre.
let dernieres = null

const chargerRenfo = async () => {
  const [profile, bands, done, pending] = await Promise.all([
    getProfile(), getBands(), getDoneSessions(), getPendingSession(),
  ])
  return { profile, bands, done, pending, suggestion: suggestionDe({ profile, bands, done }) }
}

// Course et Renfo en parallèle ; un échec de Renfo retire seulement la bande.
const charger = ({ training, renfo }) => Promise.all([
  training ? getAujourdhui() : null,
  renfo
    ? chargerRenfo().catch((e) => {
      console.error('[accueil] Renfo :', e)
      return null
    })
    : null,
]).then(([course, renfoDonnees]) => ({ course, renfo: renfoDonnees }))

/**
 * Bloc « Aujourd'hui » de l'Accueil (lot A2), chargé en différé par Home (hors du
 * chunk d'entrée) : widgets Séance et Semaine pour un compte
 * avec Training, puis la bande Renfo dès qu'il y a un profil Renfo. Compte avec Renfo
 * seul : le bloc n'apparaît qu'avec la bande. Attente à la hauteur des widgets, échec en carte.
 */
const BlocAujourdhui = ({ userId, training, renfo }) => {
  const navigate = useAppNavigate()
  const cle = `${userId}:${training}:${renfo}`
  const deja = dernieres?.cle === cle ? dernieres.donnees : null
  const [etat, setEtat] = useState(() => (deja ? { status: 'ready', donnees: deja, essai: 0 } : { status: 'loading', essai: 0 }))
  const attente = useFinAttente(etat.status === 'loading')

  useEffect(() => {
    let annule = false
    charger({ training, renfo }).then(
      (donnees) => {
        dernieres = { cle, donnees }
        if (!annule) setEtat((e) => ({ ...e, status: 'ready', donnees }))
      },
      (e) => {
        console.error('[accueil] journée :', e)
        // Relecture discrète qui échoue : on garde ce qui est affiché.
        if (!annule) setEtat((x) => (x.donnees ? x : { ...x, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [cle, training, renfo, etat.essai])

  const aujourdhui = todayISO()
  const ouvrir = (chemin, options = {}) => () => navigate(chemin, { direction: 'forward', ...options })

  const donnees = etat.status === 'ready' ? etat.donnees : null
  const bande = donnees?.renfo ? bandeRenfo({ ...donnees.renfo, aujourdhui }) : null

  // Renfo seul : le bloc apparaît avec la bande, dès qu'il y a un profil Renfo.
  if (!training && !bande) return null

  let contenu
  if (training && attente.visible) {
    contenu = (
      <Box sx={{ height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ width: '160px' }}>
          <BarreAttente place="section" duree={DUREES.chargementPage} {...attente} />
        </Box>
      </Box>
    )
  } else if (training && etat.status === 'error') {
    contenu = (
      <CarteSysteme
        titre="Impossible de charger ta journée"
        phrase="Les données n'ont pas pu être chargées."
        bouton="Réessayer"
        onClick={() => setEtat((e) => ({ ...e, status: 'loading', essai: e.essai + 1 }))}
      />
    )
  } else if (donnees) {
    const course = training && donnees.course ? vueCourse({ ...donnees.course, aujourdhui }) : null
    const planId = donnees.course?.plan?.id
    contenu = (
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: space[12] }}>
        {course?.sansPlan && (
          <ButtonBase onClick={ouvrir('/training')} aria-label="Aucun plan en cours, créer un plan" sx={{ ...WIDGET_SX, gridColumn: '1 / -1' }}>
            <Typography variant="legende" component="span" sx={{ fontWeight: 600, color: 'muted' }}>Training</Typography>
            <Typography variant="chiffre-widget" component="span" sx={{ mt: space[4] }}>Aucun plan en cours</Typography>
            <Typography variant="secondaire" component="span" sx={{ color: 'muted', maxWidth: '280px' }}>
              Choisis ta prochaine course, le plan se construit à partir de tes données.
            </Typography>
            <Typography variant="corps-fort" component="span" sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: space[4] }}>
              Créer un plan
              <ChevronDroit taille={16} />
            </Typography>
          </ButtonBase>
        )}
        {course && !course.sansPlan && (
          <>
            <WidgetSeance
              {...course.seance}
              repos={course.seance.etat === 'repos'}
              onClick={course.seance.sessionId
                ? ouvrir(`/training/plan/${planId}/session/${course.seance.sessionId}`, { state: { retour: '/' } })
                : ouvrir('/training')}
            />
            <WidgetSemaine {...course.semaine} onClick={ouvrir('/training')} />
          </>
        )}
        {bande && (
          <BandeRenfo
            {...bande}
            onClick={ouvrir(bande.cible, bande.cible === '/renfo' ? {} : { state: { retour: '/' } })}
          />
        )}
      </Box>
    )
  } else {
    contenu = null
  }

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
      <EnTeteAujourdhui aujourdhui={aujourdhui} />
      {contenu}
    </Box>
  )
}

export default BlocAujourdhui
