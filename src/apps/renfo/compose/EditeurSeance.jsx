import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { DUREES } from '../../../lib/durees'
import { PAS_DE_CONNEXION, estErreurReseau } from '../../../lib/reseau'
import { border, size, space } from '../../../styles/tokens'
import BarreAttente from '../../../ui/BarreAttente'
import Bouton from '../../../ui/Bouton'
import Carte from '../../../ui/Carte'
import ControleSegmente from '../../../ui/ControleSegmente'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import Page from '../../../ui/Page'
import { ChevronDroit } from '../../../ui/Icones'
import { useMessage } from '../../../ui/useMessage'
import { availableExercises } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import {
  estimerComposition, groupesDisponibles, intensiteDeduite, maxExercices, preremplir, themePourGroupe, titreSeance,
} from '../../../../supabase/functions/_shared/strength/compose.ts'
import { GROUP_LABELS, groupOfFocus, SUPERSETS_MAX } from '../../../../supabase/functions/_shared/strength/rules.ts'
import { INTENSITE_LABELS, libelleSupersets, resumeComposition } from '../accueil'
import { generationErrorMessage } from '../errors'
import CarteEtat from './CarteEtat'
import Depli from './Depli'
import LigneSuperset from './LigneSuperset'
import { ligneBouton } from './ligne'

const INTENSITES = Object.entries(INTENSITE_LABELS).map(([valeur, libelle]) => ({ valeur, libelle }))
const EXERCICES_PAR_DEFAUT = 3
const TOURS_PAR_DEFAUT = 3

// Identifiant stable de chaque superset à l'écran (clé React, accordéon).
let prochainId = 1
const avecId = (s, apparait = false) => ({ ...s, id: prochainId++, apparait })

const filet = { borderTop: `${border.filet} solid`, borderColor: 'line' }

/**
 * Composition d'une séance, sa préparation et ses échecs, sur la même route. Réutilisable
 * pour modifier une séance (lot R3) :
 * - depart : { intensity (ou null : aucun segment choisi), supersets: [{ focus, exercise_count, rounds }] }.
 * - donnees : { profile, bands, done, bases }.
 * - libelleEnvoi : texte du bouton (« Créer la séance »).
 * - envoyer(composition) : promesse de { session } ; onSession(session) une fois prête.
 * - onEnAttente(err) : renvoie l'identifiant de séance d'une erreur qui doit ouvrir une séance existante, sinon null.
 */
const EditeurSeance = ({ depart, donnees, libelleEnvoi, envoyer, onSession, onEnAttente }) => {
  const { afficher } = useMessage()
  const available = useMemo(
    () => availableExercises(donnees.profile?.equipment ?? [], donnees.bands.map((b) => b.kg)),
    [donnees],
  )
  const bandsKg = useMemo(() => donnees.bands.map((b) => b.kg), [donnees])

  const [intensite, setIntensite] = useState(depart.intensity)
  const [supersets, setSupersets] = useState(() => depart.supersets.map((s) => avecId(s)))
  const [ouvert, setOuvert] = useState(null)
  // Feuille du groupe : { pour: id du superset, ou 'ajout', numero }, gardée pendant sa fermeture.
  const [feuille, setFeuille] = useState(null)
  const [feuilleOuverte, setFeuilleOuverte] = useState(false)
  // phase : 'composition', 'preparation' (avec issue une fois la réponse arrivée), 'echec'.
  const [envoi, setEnvoi] = useState({ phase: 'composition' })

  const montee = useRef(false)
  useEffect(() => {
    montee.current = true
    return () => { montee.current = false }
  }, [])

  const actifs = supersets.filter((s) => !s.retire)
  const composition = {
    intensity: intensite ?? intensiteDeduite(actifs.length),
    supersets: actifs.map(({ focus, exercise_count, rounds }) => ({ focus, exercise_count, rounds })),
  }
  const minutes = estimerComposition(composition, available, { bases: donnees.bases ?? {}, bandsKg })
  const sousLigne = actifs.length
    ? `${libelleSupersets(actifs.length)} · ≈ ${minutes} min`
    : 'Aucun superset'

  const choisirIntensite = (valeur) => {
    if (valeur === intensite) return
    const c = preremplir({ intensity: valeur, sessions: donnees.done, available })
    setIntensite(valeur)
    setSupersets(c.supersets.map((s) => avecId(s)))
    setOuvert(null)
  }

  const modifier = (id, champs) => setSupersets((list) => list.map((s) => (s.id === id ? { ...s, ...champs } : s)))

  const choisirGroupe = (groupe) => {
    const pour = feuille?.pour
    if (pour === 'ajout') {
      const focus = themePourGroupe(groupe, actifs, donnees.done, available)
      if (!focus) return
      setSupersets((list) => [...list, avecId({
        focus,
        exercise_count: Math.min(EXERCICES_PAR_DEFAUT, maxExercices(focus, available)),
        rounds: TOURS_PAR_DEFAUT,
      }, true)])
      return
    }
    const cible = actifs.find((s) => s.id === pour)
    if (!cible || groupOfFocus(cible.focus) === groupe) return
    const focus = themePourGroupe(groupe, actifs.filter((s) => s.id !== pour), donnees.done, available)
    if (!focus) return
    modifier(pour, { focus, exercise_count: Math.min(cible.exercise_count, maxExercices(focus, available)) })
  }

  const retirer = (id) => {
    setOuvert(null)
    modifier(id, { retire: true })
  }

  const lancer = (c) => {
    setEnvoi({ phase: 'preparation', composition: c })
    envoyer(c).then(
      ({ session }) => setEnvoi((e) => ({ ...e, issue: { session } })),
      (err) => {
        const enAttente = onEnAttente?.(err)
        if (enAttente) {
          setEnvoi((e) => ({ ...e, issue: { session: { id: enAttente } } }))
          return
        }
        console.error('[renfo composer]', err)
        setEnvoi((e) => ({ ...e, issue: { err } }))
      },
    )
  }

  // Fin de la barre : la séance s'ouvre, ou l'échec s'affiche.
  const finPreparation = () => {
    const issue = envoi.issue
    if (!issue || !montee.current) return
    if (issue.session) {
      onSession(issue.session)
      return
    }
    if (estErreurReseau(issue.err)) {
      setEnvoi({ phase: 'composition' })
      afficher(PAS_DE_CONNEXION)
      return
    }
    setEnvoi({ phase: 'echec', composition: envoi.composition, err: issue.err })
  }

  if (envoi.phase !== 'composition') {
    const c = envoi.composition
    const resume = resumeComposition(c.intensity, c.supersets.length)
    const titre = titreSeance(c.supersets.map((s) => s.focus))
    return (
      <Page gap={space[24]}>
        {envoi.phase === 'preparation' ? (
          <CarteEtat resume={resume} titre={titre}>
            <Typography variant="corps-fort">Préparation de ta séance</Typography>
            <Typography variant="secondaire" sx={{ color: 'muted' }}>Jusqu'à 30 secondes, reste sur cet écran.</Typography>
            <BarreAttente
              place="section"
              phrase="Préparation de ta séance"
              duree={DUREES.preparationRenfo}
              visible
              fini={Boolean(envoi.issue)}
              onFin={finPreparation}
              sx={{ mt: space[8] }}
            />
          </CarteEtat>
        ) : (
          <CarteEtat resume={resume} titre={titre}>
            <Typography variant="corps-fort">La préparation a échoué</Typography>
            <Typography variant="secondaire" sx={{ color: 'muted' }}>{generationErrorMessage(envoi.err)}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], pt: space[12] }}>
              <Bouton pleineLargeur onClick={() => lancer(c)}>Réessayer</Bouton>
              <Bouton variante="texte" petit pleineLargeur onClick={() => setEnvoi({ phase: 'composition' })}>
                Modifier la séance
              </Bouton>
            </Box>
          </CarteEtat>
        )}
      </Page>
    )
  }

  const ouvrirFeuille = (pour, numero) => {
    setFeuille({ pour, numero })
    setFeuilleOuverte(true)
  }

  return (
    <Page gap={space[24]} sx={{ minHeight: '100%', boxSizing: 'border-box' }}>
      <Carte sx={{ gap: space[12] }}>
        <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Intensité</Typography>
        <ControleSegmente label="Intensité" options={INTENSITES} valeur={intensite} onChange={choisirIntensite} />
        <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{sousLigne}</Typography>
      </Carte>

      <Carte sx={{ pb: space[8] }}>
        <Typography variant="etiquette" component="h2" sx={{ color: 'muted', pb: space[8] }}>Ta séance</Typography>
        {supersets.map((s) => {
          const numero = actifs.indexOf(s) + 1
          return (
            <LigneSuperset
              key={s.id}
              numero={numero > 0 ? numero : ''}
              superset={s}
              ouvert={ouvert === s.id && !s.retire}
              max={maxExercices(s.focus, available)}
              onBasculer={() => setOuvert((o) => (o === s.id ? null : s.id))}
              onGroupe={() => ouvrirFeuille(s.id, numero)}
              onChange={(champs) => modifier(s.id, champs)}
              onRetirer={() => retirer(s.id)}
              onExited={() => setSupersets((list) => list.filter((x) => x.id !== s.id))}
            />
          )
        })}
        <Depli ouvert={actifs.length < SUPERSETS_MAX}>
          <ButtonBase
            onClick={() => ouvrirFeuille('ajout', actifs.length + 1)}
            sx={{ ...ligneBouton, ...filet, minHeight: size.ligne, color: 'muted' }}
          >
            <Typography variant="corps-fort" component="span" sx={{ width: '14px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {actifs.length + 1}
            </Typography>
            <Typography variant="corps" component="span" sx={{ flex: '1 1 0', fontSize: '15px' }}>Ajouter un superset</Typography>
            <Box component="span" sx={{ display: 'flex', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
          </ButtonBase>
        </Depli>
      </Carte>

      <Box sx={{ mt: 'auto' }}>
        <Bouton
          niveau="page"
          pleineLargeur
          disabled={!actifs.length}
          raison="Ajoute au moins un superset."
          onClick={() => lancer(composition)}
        >
          {libelleEnvoi}
        </Bouton>
      </Box>

      <FeuilleFlottante
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        titre={`Groupe du superset ${feuille?.numero ?? ''}`}
        lignes={groupesDisponibles(available).map((g) => ({ libelle: GROUP_LABELS[g], onClick: () => choisirGroupe(g) }))}
      />
    </Page>
  )
}

export default EditeurSeance
