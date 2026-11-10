import { useEffect, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { etatSeance } from '../../../lib/retour'
import { Box } from '@mui/material'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { useConnexionSource } from '../../../hooks/useConnexionSource'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import BarreAttente from '../../../ui/BarreAttente'
import FeuilleDate from '../../../ui/FeuilleDate'
import PageRessenti from '../../../ui/PageRessenti'
import { moisDe } from '../../../ui/calendrier'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { useMessage } from '../../../ui/useMessage'
import { DUREES } from '../../../lib/durees'
import { PAS_DE_CONNEXION, estErreurReseau } from '../../../lib/reseau'
import { emptyFeedback } from '../../../lib/feedback'
import { completeSession, corosMatch, getSession } from '../../../lib/training'
import { space } from '../../../styles/tokens'
import {
  cleanText, todayISO, ZONE_DAYS, joursCreneau, fenetreRecherche, plageRecherche, jourSeanceParDefaut,
} from '../constants'
import {
  apresRecherche, selectionVide, toucherActivite, toucherSans, activitesAEnvoyer,
} from './selectionActivites'
import BlocActivite from './BlocActivite'

const VALIDABLE = ['planned', 'adapted']

// Recherche Coros → état du bloc Activité.
const lireRecherche = (sessionId) => corosMatch(sessionId).then(
  ({ candidates }) => {
    const liste = (candidates ?? []).filter((c) => c?.labelId)
    return { etat: liste.length ? 'liste' : 'vide', candidats: liste }
  },
  (e) => {
    console.error('[training valider] recherche des activités :', e)
    // Jeton Coros mort : coros-match répond 503 « Coros authentication required ».
    if (e?.status === 503 && e.body?.error === 'Coros authentication required') {
      return { etat: 'expiree', candidats: [] }
    }
    return { etat: 'echec', candidats: [], reseau: estErreurReseau(e) }
  },
)

/** Page « Valider la séance » de Training : activités Coros, puis le ressenti. */
const ValiderPage = () => {
  const { planId, sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  // Training ne lit encore que Coros (plan.source n'est pas encore lu ni appliqué).
  const connexion = useConnexionSource()
  const { afficher } = useMessage()
  const pageSeance = `/training/plan/${planId}/session/${sessionId}`
  // État de la séance (son retour vers l'Historique), rendu après un replace.
  const etatPageSeance = etatSeance(location)

  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const [recherche, setRecherche] = useState({ etat: 'recherche', candidats: [], essai: 0 })
  const [selection, setSelection] = useState(selectionVide)
  const [jour, setJour] = useState(null)
  const [feuilleJour, setFeuilleJour] = useState({ ouverte: false, mois: null, valeur: null })
  const [ressenti, setRessenti] = useState(emptyFeedback)
  const [phrase, setPhrase] = useState('')

  const attente = useFinAttente(chargement.status === 'loading')
  const attenteRecherche = useFinAttente(recherche.etat === 'recherche')
  const action = useAction({
    attente: phrase,
    duree: DUREES.validation,
    echec: 'La validation n\'a pas abouti. Réessaie.',
  })

  // Le retour après la validation n'a lieu que si la page est encore montée : un
  // chevron touché pendant l'attente a déjà ramené à la séance.
  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  // Changement de séance : tout repart au rendu, l'effet ne fait que charger.
  if (chargement.sessionId !== sessionId) {
    setChargement({ status: 'loading', sessionId, essai: 0 })
    setRecherche({ etat: 'recherche', candidats: [], essai: 0 })
    setSelection(selectionVide())
    setRessenti(emptyFeedback())
  }

  useEffect(() => {
    let annule = false
    getSession(sessionId).then(
      (s) => {
        if (annule) return
        if (!VALIDABLE.includes(s.status)) {
          navigate(`/training/plan/${planId}/session/${sessionId}`, { replace: true, direction: 'back', state: etatPageSeance })
          return
        }
        setJour(jourSeanceParDefaut(s.scheduled_date, todayISO()))
        setChargement((c) => ({ ...c, status: 'ready', session: s }))
      },
      (e) => {
        console.error('[training valider] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, planId, chargement.essai, navigate, etatPageSeance])

  const pret = chargement.status === 'ready'
  useEffect(() => {
    if (!pret) return undefined
    let annule = false
    lireRecherche(sessionId).then((r) => {
      if (annule) return
      if (r.reseau) afficher(PAS_DE_CONNEXION)
      setRecherche((prev) => ({ ...prev, etat: r.etat, candidats: r.candidats }))
      setSelection(apresRecherche(r.candidats))
    })
    return () => { annule = true }
  }, [pret, sessionId, recherche.essai, afficher])

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error') {
    return (
      <Box sx={{ px: space[16], pt: `calc(${HEADER_HEIGHT}px + ${space[8]})` }}>
        <CarteSysteme
          titre="Séance introuvable"
          phrase="Elle n'a pas pu être chargée."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Box>
    )
  }
  if (!pret) return null

  const { session } = chargement
  const aujourdhui = todayISO()
  const titre = cleanText(session.title)
  const creneauTexte = ZONE_DAYS[session.zone] ? `créneau ${ZONE_DAYS[session.zone]}` : ''
  const contexte = [titre, creneauTexte].filter(Boolean).join(' · ')
  const etat = attenteRecherche.visible ? 'recherche' : recherche.etat
  const fenetre = fenetreRecherche(session.week_start, session.scheduled_date, aujourdhui)
  const creneau = joursCreneau(session.scheduled_date, session.zone)

  const reessayer = () => setRecherche((r) => ({ ...r, etat: 'recherche', essai: r.essai + 1 }))

  const ouvrirJour = () => setFeuilleJour({ ouverte: true, mois: moisDe(jour), valeur: jour })
  const fermerJour = () => setFeuilleJour((f) => ({ ...f, ouverte: false }))
  const creneauVisible = creneau.some((j) => moisDe(j) === feuilleJour.mois && j <= aujourdhui)

  const retour = () => {
    if (!montee.current) return
    if (location.key === 'default') navigate(pageSeance, { replace: true, direction: 'back', state: etatPageSeance })
    else navigate(-1, { direction: 'back' })
  }

  const valider = async (feedback) => {
    const activites = etat === 'liste' ? activitesAEnvoyer(selection, recherche.candidats) : null
    // Phrase figée au lancement.
    setPhrase(activites ? 'Validation et analyse de ta séance' : 'Validation de ta séance')
    const { ok } = await action.lancer(() => completeSession(sessionId, activites, feedback, activites ? null : jour))
    if (ok) retour()
  }

  return (
    <>
      <PageRessenti
        contexte={contexte}
        activite={(
          <BlocActivite
            etat={etat}
            attente={attenteRecherche}
            candidats={recherche.candidats}
            selection={selection}
            onActivite={(id) => setSelection((s) => toucherActivite(s, id))}
            onSans={() => setSelection((s) => toucherSans(s, recherche.candidats))}
            jour={jour}
            onJour={ouvrirJour}
            plage={fenetre ? plageRecherche(fenetre) : null}
            onReconnecter={() => connexion.lancer('coros', `${location.pathname}${location.search}`)}
            reconnexion={connexion.barre}
            onReessayer={reessayer}
          />
        )}
        valeur={ressenti}
        onChange={setRessenti}
        onValider={valider}
        action={action}
        boutonsDesactives={etat === 'recherche'}
        phraseBarre="Recherche de tes activités en cours."
      />

      <FeuilleDate
        ouverte={feuilleJour.ouverte}
        onFermer={fermerJour}
        titre="Jour de la séance"
        sousTitre={contexte}
        mois={feuilleJour.mois}
        onMois={(m) => setFeuilleJour((f) => ({ ...f, mois: m }))}
        valeur={feuilleJour.valeur}
        max={aujourdhui}
        creneau={creneau}
        aujourdhui={aujourdhui}
        onChoisir={(j) => setFeuilleJour((f) => ({ ...f, valeur: j }))}
        ligne={{ libelle: 'Valider', onClick: () => setJour(feuilleJour.valeur) }}
        legendes={[creneauVisible && 'En fond : les jours du créneau.']}
      />
    </>
  )
}

export default ValiderPage
