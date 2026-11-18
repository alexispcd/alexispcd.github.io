import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { border, size, space } from '../../../styles/tokens'
import Bouton from '../../../ui/Bouton'
import Carte from '../../../ui/Carte'
import Compteur from '../../../ui/Compteur'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import Page from '../../../ui/Page'
import { Alerte, ChevronDroit } from '../../../ui/Icones'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { groupesDisponibles, themePourGroupe } from '../../../../supabase/functions/_shared/strength/compose.ts'
import {
  GROUP_LABELS, groupOfFocus, ROUNDS_MAX, ROUNDS_MIN, SUPERSETS_MAX, TRISET_FOCUS_LABELS,
} from '../../../../supabase/functions/_shared/strength/rules.ts'
import Depli from '../compose/Depli'
import LigneBloc from '../compose/LigneBloc'
import { ligneBouton } from '../compose/ligne'
import FicheExercice from './FicheExercice'
import LigneExercice from './LigneExercice'
import {
  actifs, ajouterSuperset, changerTheme, changerTours, enleverSuperset, exercicesDe, manqueDe, manques, maxDe,
  retirerExercice, retirerSuperset, sousLigneBloc,
} from './modifier'
import { ligneDose } from './seance'

const filet = { borderTop: `${border.filet} solid`, borderColor: 'line' }
const decale = { pl: space[24] }

const TYPE_DE = { warmup: 'warmup', cooldown: 'cooldown' }
const typeDe = (cle) => TYPE_DE[cle] ?? 'superset'
const idManque = (cle) => `manque-${cle}`

/**
 * Carte « Ta séance » de Modifier (lot R7) : échauffement, supersets, « Ajouter un
 * superset », retour au calme, en accordéon (un seul bloc déplié), puis « Enregistrer »,
 * jamais désactivé. Tout change la séance en attente (etat, voir modifier.js).
 * - setEtat(fn) : mise à jour de la séance en attente, gardée par ModifierPage.
 * - session : la séance (bands_used pour les doses) ; bands, available, done : le compte.
 * - onAjouter(cle), onRemplacer(cle, slug) : ouvrent la liste d'exercices.
 * - onEnregistrer() : appelé seulement si chaque bloc a assez d'exercices ; sinon le
 *   premier bloc fautif se déplie, prend le focus et dit ce qui manque.
 */
const EditeurExercices = ({ etat, setEtat, session, bands, available, done, onAjouter, onRemplacer, onEnregistrer }) => {
  const [ouvert, setOuvert] = useState(null)
  const [tentative, setTentative] = useState(false)
  // Feuille du groupe : { pour: id du superset, ou 'ajout', numero }, gardée pendant sa fermeture.
  const [feuille, setFeuille] = useState(null)
  const [feuilleOuverte, setFeuilleOuverte] = useState(false)
  // Fiche : { cle, slug, ex }, gardée pendant sa fermeture (ex : l'exercice à l'ouverture).
  const [fiche, setFiche] = useState(null)
  const [ficheOuverte, setFicheOuverte] = useState(false)
  const boutons = useRef({})

  const liste = actifs(etat)

  const basculer = (cle) => setOuvert((o) => (o === cle ? null : cle))

  const ouvrirFeuille = (pour, numero) => {
    setFeuille({ pour, numero })
    setFeuilleOuverte(true)
  }

  const choisirGroupe = (groupe) => {
    const pour = feuille?.pour
    if (pour === 'ajout') {
      const focus = themePourGroupe(groupe, liste, done, available)
      if (!focus) return
      const { etat: suivant, id } = ajouterSuperset(etat, focus)
      setEtat(() => suivant)
      setOuvert(id)
      return
    }
    const cible = liste.find((s) => s.id === pour)
    if (!cible || groupOfFocus(cible.focus) === groupe) return
    const focus = themePourGroupe(groupe, liste.filter((s) => s.id !== pour), done, available)
    if (focus) setEtat((e) => changerTheme(e, pour, focus))
  }

  const ouvrirFiche = (cle, ex) => {
    setFiche({ cle, slug: ex.slug, ex })
    setFicheOuverte(true)
  }

  const enregistrer = () => {
    const [premier] = manques(etat)
    if (!premier) {
      onEnregistrer()
      return
    }
    // La phrase et l'aria-describedby sont posés avant le focus, pour être annoncés avec lui.
    flushSync(() => {
      setTentative(true)
      setOuvert(premier.cle)
    })
    boutons.current[premier.cle]?.focus()
  }

  // Exercices, « Ajouter un exercice » et la phrase de ce qui manque, communs à tous les blocs.
  const exercices = (cle) => {
    const block = { type: typeDe(cle) }
    const manque = tentative ? manqueDe(etat, cle) : null
    const list = exercicesDe(etat, cle)
    return (
      <>
        {list.map((ex) => (
          <LigneExercice
            key={ex.slug}
            nom={EXERCISE_INDEX[ex.slug]?.name ?? ex.slug}
            dose={ligneDose(ex.dose, session.bands_used, block)}
            onClick={() => ouvrirFiche(cle, ex)}
          />
        ))}
        {list.length < maxDe(cle) && (
          <ButtonBase
            onClick={() => onAjouter(cle)}
            sx={{ ...ligneBouton, ...filet, ml: space[24], width: `calc(100% - ${space[24]})`, minHeight: size.ligne, color: 'muted' }}
          >
            <Typography variant="corps" component="span" sx={{ flex: '1 1 0', fontSize: '15px' }}>Ajouter un exercice</Typography>
            <Box component="span" sx={{ display: 'flex', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
          </ButtonBase>
        )}
        {manque && (
          <Box
            id={idManque(cle)}
            sx={{ display: 'flex', alignItems: 'center', gap: space[8], pt: space[8], pb: space[4], ...decale, color: 'ink' }}
          >
            <Box component="span" sx={{ display: 'flex', flexShrink: 0 }}><Alerte taille={16} /></Box>
            <Typography variant="corps-fort" component="span" sx={{ fontSize: '14px' }}>{manque}</Typography>
          </Box>
        )}
      </>
    )
  }

  const blocListe = (cle, titre) => {
    const manque = tentative && ouvert === cle && manqueDe(etat, cle)
    return (
      <LigneBloc
        titre={titre}
        sousLigne={sousLigneBloc(etat, cle) || 'Aucun exercice'}
        ouvert={ouvert === cle}
        onBasculer={() => basculer(cle)}
        refBouton={(el) => { boutons.current[cle] = el }}
        decritPar={manque ? idManque(cle) : undefined}
      >
        {exercices(cle)}
      </LigneBloc>
    )
  }

  // L'exercice à jour, sinon celui de l'ouverture (retiré, la fiche se referme avec lui).
  const exFiche = fiche ? exercicesDe(etat, fiche.cle).find((e) => e.slug === fiche.slug) ?? fiche.ex : null

  return (
    <Page gap={space[24]} sx={{ minHeight: '100%', boxSizing: 'border-box' }}>
      <Carte sx={{ pb: space[8] }}>
        <Typography variant="etiquette" component="h2" sx={{ color: 'muted', pb: space[8] }}>Ta séance</Typography>

        {blocListe('warmup', 'Échauffement')}

        {etat.supersets.map((s) => {
          const numero = liste.indexOf(s) + 1
          const groupe = GROUP_LABELS[groupOfFocus(s.focus)] ?? ''
          const manque = tentative && ouvert === s.id && manqueDe(etat, s.id)
          return (
            <LigneBloc
              key={s.id}
              numero={numero > 0 ? numero : ''}
              titre={TRISET_FOCUS_LABELS[s.focus] ?? ''}
              sousLigne={sousLigneBloc(etat, s.id)}
              ouvert={ouvert === s.id && !s.retire}
              present={!s.retire}
              apparait={s.apparait}
              onBasculer={() => basculer(s.id)}
              onExited={() => setEtat((e) => enleverSuperset(e, s.id))}
              refBouton={(el) => { boutons.current[s.id] = el }}
              decritPar={manque ? idManque(s.id) : undefined}
            >
              <ButtonBase
                aria-label="Changer le groupe du superset"
                onClick={() => ouvrirFeuille(s.id, numero)}
                sx={{ ...ligneBouton, ...decale, minHeight: size.ligne }}
              >
                <Typography variant="corps" component="span" sx={{ flex: '1 1 0' }}>Groupe</Typography>
                <Typography variant="corps-fort" component="span">{groupe}</Typography>
                <Box component="span" sx={{ display: 'flex', flexShrink: 0, color: 'muted' }}><ChevronDroit taille={16} /></Box>
              </ButtonBase>
              <Compteur
                libelle="Tours"
                valeur={s.rounds}
                min={ROUNDS_MIN}
                max={ROUNDS_MAX}
                onChange={(v) => setEtat((e) => changerTours(e, s.id, v))}
                labelMoins="Un tour de moins"
                labelPlus="Un tour de plus"
                sx={decale}
              />
              {exercices(s.id)}
              {liste.length > 1 && (
                <ButtonBase
                  onClick={() => {
                    setOuvert(null)
                    setEtat((e) => retirerSuperset(e, s.id))
                  }}
                  sx={{ ...ligneBouton, ...decale, minHeight: size.cible, color: 'muted' }}
                >
                  <Typography variant="corps" component="span">Retirer ce superset</Typography>
                </ButtonBase>
              )}
            </LigneBloc>
          )
        })}

        <Depli ouvert={liste.length < SUPERSETS_MAX}>
          <ButtonBase
            onClick={() => ouvrirFeuille('ajout', liste.length + 1)}
            sx={{ ...ligneBouton, ...filet, minHeight: size.ligne, color: 'muted' }}
          >
            <Typography variant="corps-fort" component="span" sx={{ width: '14px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              {liste.length + 1}
            </Typography>
            <Typography variant="corps" component="span" sx={{ flex: '1 1 0', fontSize: '15px' }}>Ajouter un superset</Typography>
            <Box component="span" sx={{ display: 'flex', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
          </ButtonBase>
        </Depli>

        {blocListe('cooldown', 'Retour au calme')}
      </Carte>

      <Box sx={{ mt: 'auto' }}>
        <Bouton niveau="page" pleineLargeur onClick={enregistrer}>Enregistrer</Bouton>
      </Box>

      <FeuilleFlottante
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        titre={`Groupe du superset ${feuille?.numero ?? ''}`}
        lignes={groupesDisponibles(available).map((g) => ({ libelle: GROUP_LABELS[g], onClick: () => choisirGroupe(g) }))}
      />

      <FicheExercice
        ouverte={ficheOuverte}
        onFermer={() => setFicheOuverte(false)}
        cible={exFiche ? { dose: exFiche.dose, block: { type: typeDe(fiche.cle) } } : null}
        bandsUsed={session.bands_used}
        bands={bands}
        enAttente
        onRemplacer={() => fiche && onRemplacer(fiche.cle, fiche.slug)}
        onRetirer={() => fiche && setEtat((e) => retirerExercice(e, fiche.cle, fiche.slug))}
      />
    </Page>
  )
}

export default EditeurExercices
