import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { useAppCtx } from '../../../lib/context'
import { DUREES } from '../../../lib/durees'
import { texteErreur } from '../../../lib/reseau'
import { etatSousPage } from '../../../lib/retour'
import { painAreaLabel } from '../../../lib/feedback'
import { deleteFreeSession, getBands, getPendingSession, getSession, resetSession } from '../../../lib/renfo'
import { SPACE_BAS, border, radius, size, space, textStyles } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import BarreAttente from '../../../ui/BarreAttente'
import BarreBas from '../../../ui/BarreBas'
import BarreProgression from '../../../ui/BarreProgression'
import Bouton from '../../../ui/Bouton'
import Carte from '../../../ui/Carte'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import MarqueSeance from '../../../ui/MarqueSeance'
import Pastille from '../../../ui/Pastille'
import { sansMouvement } from '../../../ui/appui'
import { ChevronBas, ChevronDroit } from '../../../ui/Icones'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { useMessage } from '../../../ui/useMessage'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { estNouveauFormat } from '../../../../supabase/functions/_shared/strength/compose.ts'
import { bandColorFor, formatKg } from '../bandColor'
import { ANCHOR_LABELS, bandOf, equipmentSummary, titreAffiche } from '../content'
import Depli from '../compose/Depli'
import { ligneBouton } from '../compose/ligne'
import RenfoPlayer from '../player/RenfoPlayer'
import { createBeeps } from '../player/beeps'
import { arretLibelle, effacerPosition, etatBlocs, lirePosition } from '../player/position'
import { buildSequence } from '../player/sequence'
import ExerciseThumb from './ExerciseThumb'
import PastillesExercice from './PastillesExercice'
import { useFicheExercice } from './useFicheExercice'
import {
  doseDeLigne, exercicesDuBloc, ligneBloc, ligneEnTete, phraseReinitialisation, phraseSuppression, prevu,
  rangSuperset, themesSeance, titreBloc,
} from './seance'

// Position gardée par le player (séance en cours ou finie sans être validée). Une
// séance faite n'en a pas ; une séance changée depuis (Modifier, Remplacer) la perd.
const positionDe = (session) =>
  (session.status === 'planned' ? lirePosition(session.id, buildSequence(session.content).steps) : null)

const chargerPage = async (sessionId) => {
  const [session, bands] = await Promise.all([getSession(sessionId), getBands()])
  return { session, bands, position: positionDe(session) }
}

const SEANCE_EN_ATTENTE = 'Une autre séance est déjà à faire. Fais-la ou supprime-la d\'abord.'
const REINITIALISATION_ECHEC = "La séance n'a pas pu être remise à faire. Réessaie."

const filet = { borderTop: `${border.filet} solid`, borderColor: 'line' }

// Carte d'attente en tête de page : l'écart du bas s'ouvre et se replie avec elle.
const CARTE_ATTENTE_SX = { '& .MuiCollapse-wrapperInner': { pb: space[12] } }

/**
 * Page d'une séance Renfo : en-tête, ressenti d'une séance faite, blocs en accordéon,
 * fiche, Ajuster et menu des trois points ; Remplacer, Modifier et la validation ont
 * leur page. Séance en cours dans le player (position gardée) : « En cours », état des
 * blocs, « Recommencer » et « Reprendre » ; finie sans être validée : « Valider la séance ».
 */
const SessionPage = () => {
  const { sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  const { setHeaderActions } = useAppCtx()
  const { afficher } = useMessage()
  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const [ouvert, setOuvert] = useState(null) // index du bloc déplié
  const [confirmation, setConfirmation] = useState(null) // 'supprimer' | 'reinitialiser'
  const [confirmationOuverte, setConfirmationOuverte] = useState(false)
  const [player, setPlayer] = useState(null) // { beeps, position } quand le player est ouvert
  const attente = useFinAttente(chargement.status === 'loading')

  const suppression = useAction({
    attente: 'Suppression de la séance', duree: DUREES.actionCourte,
    echec: "La séance n'a pas pu être supprimée. Réessaie.",
  })
  const reinitialisation = useAction({
    attente: 'Réinitialisation de la séance', duree: DUREES.actionCourte,
    echec: REINITIALISATION_ECHEC,
  })

  // Changement de séance : tout repart au rendu, l'effet ne fait que charger.
  if (chargement.sessionId !== sessionId) {
    setChargement({ status: 'loading', sessionId, essai: 0 })
    setOuvert(null)
  }

  useEffect(() => {
    let annule = false
    chargerPage(sessionId).then(
      (res) => { if (!annule) setChargement((c) => ({ ...c, status: 'ready', ...res })) },
      (err) => {
        console.error('[renfo séance] chargement :', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, chargement.essai])

  const session = chargement.status === 'ready' ? chargement.session : null
  const statut = session?.status ?? null
  const titre = session ? titreAffiche(session.title) : ''
  const libre = session ? session.cycle_id == null : false
  const modifiable = Boolean(session) && statut === 'planned' && libre && estNouveauFormat(session.content)
  const setSession = (next) => setChargement((c) => ({ ...c, session: next }))

  const remplacer = ({ blockIndex, dose }) => {
    navigate(`/renfo/session/${session.id}/remplacer/${blockIndex}/${dose.slug}`, { direction: 'forward', state: etatSousPage(location) })
  }
  const fiche = useFicheExercice({ session, bands: chargement.bands, modifiable, onRemplacer: remplacer, onSession: setSession })
  const occupe = suppression.enCours || reinitialisation.enCours || fiche.action.enCours

  // Trois points : actions selon l'état ; rien pendant le chargement ou une attente.
  useEffect(() => {
    if (!statut) {
      setHeaderActions([])
      return undefined
    }
    const confirmer = (quoi) => {
      setConfirmation(quoi)
      setConfirmationOuverte(true)
    }
    // Une seule séance à faire à la fois : la réinitialisation n'est proposée que si
    // aucune autre n'attend. Échec de lecture : même message qu'un échec de réinitialisation.
    const reinitialiser = () => {
      getPendingSession().then(
        (attendue) => {
          if (attendue) afficher(SEANCE_EN_ATTENTE)
          else confirmer('reinitialiser')
        },
        (e) => afficher(texteErreur(e, REINITIALISATION_ECHEC)),
      )
    }
    const sousPage = (chemin) => () => navigate(chemin, { direction: 'forward', state: etatSousPage(location) })
    const supprimer = libre ? [{ label: 'Supprimer la séance', onClick: () => confirmer('supprimer'), disabled: occupe }] : []
    const actions = statut === 'done'
      ? [{ label: 'Réinitialiser la séance', onClick: reinitialiser, disabled: occupe }, ...supprimer]
      : [
          { label: 'Valider sans le player', onClick: sousPage(`/renfo/session/${sessionId}/valider`), disabled: occupe },
          ...(modifiable
            ? [{ label: 'Modifier la séance', onClick: sousPage(`/renfo/session/${sessionId}/modifier`), disabled: occupe }]
            : []),
          ...supprimer,
        ]
    setHeaderActions(actions, titre)
    return () => setHeaderActions([])
  }, [statut, libre, modifiable, occupe, titre, sessionId, navigate, location, afficher, setHeaderActions])

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
  if (!session) return null

  const { bands } = chargement
  const { content } = session
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const faite = statut === 'done'
  const position = faite ? null : chargement.position
  const { steps } = buildSequence(content)
  const etats = position ? etatBlocs(steps, position.cursor, position.fin) : null

  // Bips créés et débloqués DANS le geste utilisateur (contrainte iOS), confiés au player.
  const lancer = (depuis) => {
    if (occupe) return
    let beeps
    try {
      beeps = createBeeps()
      beeps.unlock()
    } catch {
      beeps = null
    }
    setPlayer({ beeps, position: depuis })
  }

  // Recommencer : la position tombe, le player repart de la préparation, sans confirmation.
  const recommencer = () => {
    if (occupe) return
    effacerPosition(session.id)
    setChargement((c) => ({ ...c, position: null }))
    lancer(null)
  }

  // Fermeture du player : la position est relue (gardée en quittant ou en fin de séance).
  const fermerPlayer = () => {
    setPlayer(null)
    const relue = positionDe(session)
    setChargement((c) => ({ ...c, position: relue }))
  }

  const ouvrirValidation = () => navigate(`/renfo/session/${session.id}/valider`, { direction: 'forward', state: etatSousPage(location) })

  const confirmer = async () => {
    if (confirmation === 'reinitialiser') {
      const { ok, valeur } = await reinitialisation.lancer(() => resetSession(session.id))
      if (!ok) return
      effacerPosition(session.id)
      setChargement((c) => ({ ...c, session: valeur, position: null }))
      return
    }
    const { ok } = await suppression.lancer(() => deleteFreeSession(session.id))
    if (ok) effacerPosition(session.id)
    // Retour d'où la séance a été ouverte (l'Historique), avec son état, sinon l'accueil.
    if (ok) navigate(location.state?.retour ?? '/renfo', { replace: true, direction: 'back', state: location.state?.retourEtat ?? null })
  }

  const { anchors, chair, bands: kgs } = equipmentSummary(content, session.bands_used)
  const materiel = [...anchors.map((a) => ANCHOR_LABELS[a]), ...(chair ? ['Chaise'] : [])]
  const themes = themesSeance(content)
  const ressenti = faite && (session.rpe != null || session.pain_areas?.length > 0 || Boolean(session.feedback_note))

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: '1 0 auto', px: space[16], pt: `calc(${HEADER_HEIGHT}px + ${space[8]})`, pb: faite ? SPACE_BAS : space[24] }}>
        <BarreAttente place="carte" {...suppression.barre} sx={CARTE_ATTENTE_SX} />
        <BarreAttente place="carte" {...reinitialisation.barre} sx={CARTE_ATTENTE_SX} />
        <BarreAttente place="carte" {...fiche.action.barre} sx={CARTE_ATTENTE_SX} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
          {/* En-tête */}
          <Carte sx={{ gap: space[12] }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8] }}>
              <Typography variant="legende" sx={{ color: 'muted', fontWeight: 600, minWidth: 0 }}>{themes}</Typography>
              <Pastille>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: space[4] }}>
                  <MarqueSeance etat={faite ? 'faite' : 'aFaire'} zone="ink" />
                  {faite ? 'Faite' : position ? 'En cours' : 'À faire'}
                </Box>
              </Pastille>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
              <Typography variant="titre-section" component="h1">{titre}</Typography>
              <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                {ligneEnTete(session)}
              </Typography>
            </Box>
            {(materiel.length > 0 || kgs.length > 0) && (
              <Box sx={{ ...filet, display: 'flex', flexDirection: 'column', gap: space[8], pt: space[12] }}>
                <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Matériel</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
                  {materiel.map((m) => <Pastille key={m} variante="materiel">{m}</Pastille>)}
                  {kgs.map((kg) => (
                    <Pastille key={kg} variante="bande" couleur={bandColorFor(bands, kg)}>{`${formatKg(kg)} kg`}</Pastille>
                  ))}
                </Box>
              </Box>
            )}
          </Carte>

          {/* Ressenti d'une séance faite */}
          {ressenti && (
            <Carte sx={{ gap: space[8] }}>
              <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Ressenti</Typography>
              {session.rpe != null && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <Typography variant="corps-fort">Effort</Typography>
                    <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Box component="span" sx={{ ...textStyles['titre-barre'], fontWeight: 700 }}>{session.rpe}</Box>
                      <Box component="span" sx={{ ...textStyles.secondaire, color: 'muted' }}> / 10</Box>
                    </Typography>
                  </Box>
                  <BarreProgression valeur={session.rpe} max={10} widget label={`Effort ${session.rpe} sur 10`} />
                </>
              )}
              {session.pain_areas?.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[8], pt: space[4] }}>
                  {session.pain_areas.map((code) => <Pastille key={code}>{painAreaLabel(code)}</Pastille>)}
                </Box>
              )}
              {session.feedback_note && (
                <Typography variant="secondaire" sx={{ color: 'muted', whiteSpace: 'pre-line' }}>{session.feedback_note}</Typography>
              )}
            </Carte>
          )}

          {/* Blocs, en accordéon */}
          <Carte sx={{ py: space[4], px: space[16] }}>
            {blocks.map((block, i) => {
              const deplie = ouvert === i
              const rang = rangSuperset(content, i)
              return (
                <Box key={i} sx={i > 0 ? filet : undefined}>
                  <ButtonBase
                    aria-expanded={deplie}
                    onClick={() => setOuvert((o) => (o === i ? null : i))}
                    sx={{ ...ligneBouton, minHeight: size.ligneDouble, py: space[8] }}
                  >
                    <Typography variant="corps-fort" component="span" sx={{ width: '14px', flexShrink: 0, color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                      {rang ?? ''}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
                      <Typography variant="corps-fort" component="span">{titreBloc(block)}</Typography>
                      <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                        {etats?.[i] ?? ligneBloc(block)}
                      </Typography>
                    </Box>
                    <Box
                      component="span"
                      sx={{
                        display: 'flex',
                        flexShrink: 0,
                        color: 'muted',
                        transform: deplie ? 'rotate(180deg)' : 'none',
                        transition: transition('transform', deplie ? DURATION.open : DURATION.close),
                        ...sansMouvement(),
                      }}
                    >
                      <ChevronBas taille={16} />
                    </Box>
                  </ButtonBase>
                  <Depli ouvert={deplie}>
                    {exercicesDuBloc(block).map((dose, j) => {
                      const ex = EXERCISE_INDEX[dose.slug]
                      const note = prevu(dose, session.bands_used)
                      return (
                        <ButtonBase
                          key={`${dose.slug}-${j}`}
                          onClick={() => fiche.ouvrir(dose, block, i)}
                          sx={{ ...ligneBouton, ...filet, minHeight: size.ligneDouble, py: space[8], boxSizing: 'border-box' }}
                        >
                          <ExerciseThumb slug={dose.slug} size={48} radius={radius.inner} sansContour />
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2], flex: '1 1 0', minWidth: 0 }}>
                            <Typography variant="corps-fort" component="span">{ex?.name ?? dose.slug}</Typography>
                            <Typography variant="secondaire" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                              {doseDeLigne(dose, block)}
                            </Typography>
                            <PastillesExercice slug={dose.slug} kg={bandOf(dose, session.bands_used)} bands={bands} sx={{ pt: space[2] }}>
                              {note && (
                                <Typography variant="legende" component="span" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                                  {note}
                                </Typography>
                              )}
                            </PastillesExercice>
                          </Box>
                          <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
                        </ButtonBase>
                      )
                    })}
                  </Depli>
                </Box>
              )
            })}
          </Carte>
        </Box>
      </Box>

      {!faite && position?.fin && (
        <BarreBas phrase="Terminée, pas encore validée">
          <Bouton variante="ink" onClick={ouvrirValidation} sx={{ flex: 1, minWidth: 0 }}>Valider la séance</Bouton>
        </BarreBas>
      )}
      {!faite && position && !position.fin && (
        <BarreBas phrase={arretLibelle(steps, position.cursor)}>
          <Bouton variante="chip" onClick={recommencer} sx={{ flex: 1, minWidth: 0 }}>Recommencer</Bouton>
          <Bouton variante="ink" onClick={() => lancer(position)} sx={{ flex: 2, minWidth: 0 }}>Reprendre</Bouton>
        </BarreBas>
      )}
      {!faite && !position && (
        <BarreBas>
          <Bouton variante="ink" onClick={() => lancer(null)} sx={{ flex: 1, minWidth: 0 }}>Démarrer</Bouton>
        </BarreBas>
      )}

      {fiche.feuilles}

      <FeuilleFlottante
        ouverte={confirmationOuverte}
        onFermer={() => setConfirmationOuverte(false)}
        titre={confirmation === 'reinitialiser' ? phraseReinitialisation(session) : phraseSuppression(session)}
        lignes={[{ libelle: confirmation === 'reinitialiser' ? 'Réinitialiser la séance' : 'Supprimer la séance', onClick: confirmer }]}
        fermerLibelle="Annuler"
      />

      {player && (
        <RenfoPlayer
          session={session}
          bands={bands}
          beeps={player.beeps}
          position={player.position}
          onSession={setSession}
          onFermer={fermerPlayer}
          onValider={() => {
            setPlayer(null)
            ouvrirValidation()
          }}
        />
      )}
    </Box>
  )
}

export default SessionPage
