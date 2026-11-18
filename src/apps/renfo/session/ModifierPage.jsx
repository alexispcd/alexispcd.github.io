import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { DUREES } from '../../../lib/durees'
import { editSession, getSession } from '../../../lib/renfo'
import { useAppCtx } from '../../../lib/context'
import { etatSeance } from '../../../lib/retour'
import { space } from '../../../styles/tokens'
import BarreAttente from '../../../ui/BarreAttente'
import GardeChangements from '../../../ui/GardeChangements'
import Page from '../../../ui/Page'
import { useFinAttente } from '../../../ui/useFinAttente'
import { useMessage } from '../../../ui/useMessage'
import { availableExercises } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import {
  estNouveauFormat, exercicesProposes, intensiteDeduite, titreSeance,
} from '../../../../supabase/functions/_shared/strength/compose.ts'
import { resumeComposition } from '../accueil'
import CarteEtat from '../compose/CarteEtat'
import { chargerDonnees } from '../compose/donnees'
import { generationErrorMessage } from '../errors'
import EditeurExercices from './EditeurExercices'
import ListeExercices from './ListeExercices'
import {
  actifs, ajouterExercice, blocEdition, contexteDosage, etatDe, exercicesDe, maxDe, memeSeance, remplacerExercice,
  seanceDe,
} from './modifier'
import { sousLigneListe, titreListe, titreSectionListe } from './seance'

const charger = async (sessionId) => {
  const [session, donnees] = await Promise.all([getSession(sessionId), chargerDonnees()])
  return { session, donnees }
}

// Seule une séance à faire et au nouveau format se modifie.
const modifiable = (session) => session.status === 'planned' && estNouveauFormat(session.content)

const ATTENTE = 'Enregistrement de ta séance'

// Deux couches de la même hauteur : l'éditeur reste monté (accordéon, défilement)
// sous la liste ou l'attente, caché et inerte.
const couche = { position: 'absolute', inset: 0 }
const cachee = { ...couche, visibility: 'hidden', pointerEvents: 'none' }

/**
 * Route /renfo/session/:sessionId/modifier (lot R7) : les exercices d'une séance à
 * faire, modifiés à la main et gardés en attente jusqu'à « Enregistrer » (action edit,
 * sans le modèle).
 *
 * La liste « Ajouter un exercice » ou « Remplacer » s'ouvre sur le même chemin, comme
 * une étape d'historique (state.liste = { cle, slug }, state.retour = -1) : la page
 * reste montée, rien de la séance en attente ne se perd, la garde des changements
 * (même chemin) ne s'ouvre pas, et le geste retour comme le chevron dépilent l'étape.
 */
const ModifierPage = () => {
  const { sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  const { setHeaderActions } = useAppCtx()
  const { afficher } = useMessage()
  const pageSeance = `/renfo/session/${sessionId}`

  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')
  // Séance en attente (voir modifier.js), posée au chargement.
  const [etat, setEtat] = useState(null)
  // Enregistrement : null, ou { issue } une fois la réponse arrivée ({ session } ou { err }).
  const [envoi, setEnvoi] = useState(null)

  // Étape de liste déjà quittée par un choix : un second toucher ne dépile rien de plus.
  const listeQuittee = useRef(null)

  // Le retour à la séance n'a lieu que si la page est encore montée.
  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  if (chargement.sessionId !== sessionId) setChargement({ status: 'loading', sessionId, essai: 0 })

  // État de la séance (son retour vers l'Historique), rendu après un replace. Lu dans un
  // événement : la liste change location.state, la page ne doit pas se relire pour autant.
  const renvoyer = useEffectEvent(() => {
    navigate(pageSeance, { replace: true, direction: 'back', state: etatSeance(location) })
  })

  useEffect(() => {
    let annule = false
    charger(sessionId).then(
      (res) => {
        if (annule) return
        if (!modifiable(res.session)) {
          renvoyer()
          return
        }
        setEtat(etatDe(res.session.content))
        setChargement((c) => ({ ...c, status: 'ready', ...res, depart: etatDe(res.session.content) }))
      },
      (e) => {
        console.error('[renfo modifier] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, chargement.essai])

  const { session, donnees } = chargement
  const bandsKg = useMemo(() => (donnees ? donnees.bands.map((b) => b.kg) : []), [donnees])
  const available = useMemo(
    () => (donnees ? availableExercises(donnees.profile?.equipment ?? [], bandsKg) : []),
    [donnees, bandsKg],
  )
  const ctx = useMemo(
    () => (session ? contexteDosage(session.content, donnees?.bases, bandsKg) : null),
    [session, donnees, bandsKg],
  )

  // Liste ouverte : seulement si son bloc existe encore (page rechargée sur la liste : l'éditeur).
  const demande = location.state?.liste
  const liste = etat && demande && (demande.cle === 'warmup' || demande.cle === 'cooldown' ||
    actifs(etat).some((s) => s.id === demande.cle)) &&
    (!demande.slug || exercicesDe(etat, demande.cle).some((e) => e.slug === demande.slug))
    ? demande
    : null

  // Barre du haut de la liste : « Séance », comme Remplacer depuis la page séance.
  const aListe = Boolean(liste)
  useEffect(() => {
    if (!aListe) return undefined
    setHeaderActions([], null, { titreBarre: 'Séance' })
    return () => setHeaderActions([])
  }, [aListe, setHeaderActions])

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error') {
    return (
      <Page>
        <CarteSysteme
          titre="Séance introuvable"
          phrase="Elle n'a pas pu être chargée."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Page>
    )
  }
  if (chargement.status !== 'ready' || !etat) return null

  // La séance relit sa ligne au montage : retour par l'historique, sinon en replace.
  const retour = () => {
    if (!montee.current) return
    if (location.key === 'default') navigate(pageSeance, { replace: true, direction: 'back', state: etatSeance(location) })
    else navigate(-1, { direction: 'back' })
  }

  const ouvrirListe = (cle, slug = null) => {
    navigate(location.pathname, {
      direction: 'forward',
      state: { ...location.state, liste: { cle, slug }, retour: -1 },
    })
  }

  const choisir = (slug) => {
    if (!liste || listeQuittee.current === location.key) return
    listeQuittee.current = location.key
    setEtat((e) => {
      if (liste.slug) return remplacerExercice(e, liste.cle, liste.slug, slug, ctx)
      // Bloc déjà plein (double toucher) : rien de plus.
      if (exercicesDe(e, liste.cle).length >= maxDe(liste.cle)) return e
      return ajouterExercice(e, liste.cle, slug, ctx)
    })
    navigate(-1, { direction: 'back' })
  }

  const enregistrer = () => {
    if (memeSeance(etat, chargement.depart)) {
      retour()
      return
    }
    setEnvoi({ issue: null })
    editSession(session.id, seanceDe(etat)).then(
      (res) => setEnvoi({ issue: { session: res.session } }),
      (err) => {
        console.error('[renfo modifier] enregistrement :', err)
        setEnvoi({ issue: { err } })
      },
    )
  }

  // Fin de la barre : retour à la séance, ou l'éditeur revient avec sa saisie et le Message.
  const finEnvoi = () => {
    const issue = envoi?.issue
    if (!issue || !montee.current) return
    if (issue.session) {
      retour()
      return
    }
    setEnvoi(null)
    afficher(generationErrorMessage(issue.err))
  }

  const n = actifs(etat).length
  const change = !memeSeance(etat, chargement.depart)

  let dessus = null
  if (envoi) {
    dessus = (
      <Page gap={space[24]}>
        <CarteEtat
          resume={resumeComposition(intensiteDeduite(n), n)}
          titre={titreSeance(actifs(etat).map((s) => s.focus))}
        >
          <Typography variant="corps-fort">{ATTENTE}</Typography>
          <BarreAttente
            place="section"
            phrase={ATTENTE}
            duree={DUREES.enregistrement}
            visible
            fini={Boolean(envoi.issue)}
            onFin={finEnvoi}
            sx={{ mt: space[8] }}
          />
        </CarteEtat>
      </Page>
    )
  } else if (liste) {
    const bloc = blocEdition(etat, liste.cle)
    const seance = seanceDe(etat)
    const focus = typeof bloc === 'number' ? seance.supersets[bloc]?.focus : null
    const sections = exercicesProposes(seance, { bloc, slug: liste.slug }, available)
      .map((s) => ({ ...s, titre: titreSectionListe(s.cle, focus) }))
    dessus = (
      <Page gap={space[24]}>
        <ListeExercices
          titre={titreListe(liste.slug)}
          sousLigne={sousLigneListe(bloc, focus)}
          sections={sections}
          onChoisir={choisir}
        />
      </Page>
    )
  }

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
      <Box sx={dessus ? cachee : couche} inert={dessus ? true : undefined} aria-hidden={dessus ? true : undefined}>
        <EditeurExercices
          etat={etat}
          setEtat={setEtat}
          session={session}
          bands={donnees.bands}
          available={available}
          done={donnees.done}
          onAjouter={(cle) => ouvrirListe(cle)}
          onRemplacer={(cle, slug) => ouvrirListe(cle, slug)}
          onEnregistrer={enregistrer}
        />
      </Box>
      {dessus && <Box sx={couche}>{dessus}</Box>}
      <GardeChangements actif={change && !envoi} />
    </Box>
  )
}

export default ModifierPage
