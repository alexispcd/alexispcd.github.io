import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Box, useMediaQuery } from '@mui/material'
import { keyframes } from '@emotion/react'
import { useBlocker } from 'react-router-dom'
import { estNouveauFormat } from '../../../../supabase/functions/_shared/strength/compose.ts'
import { useAppCtx } from '../../../lib/context'
import { SPACE_BAS, space } from '../../../styles/tokens'
import { DURATION, EASE } from '../../../styles/motion'
import BandeCote from '../../../ui/BandeCote'
import BarreAttente from '../../../ui/BarreAttente'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import { sansMouvement } from '../../../ui/appui'
import { bandOf, listDoses, titreAffiche } from '../content'
import { formatClock } from '../dates'
import { exercicesDuBloc } from '../session/seance'
import { useFicheExercice } from '../session/useFicheExercice'
import CarteEnsuite from './CarteEnsuite'
import CommandesPlayer from './CommandesPlayer'
import EcranExercice from './EcranExercice'
import EcranFin from './EcranFin'
import EcranPause from './EcranPause'
import EnTetePlayer from './EnTetePlayer'
import PlanSeance from './PlanSeance'
import ProgressionBlocs from './ProgressionBlocs'
import { estRecuperation, positionDroite } from './labels'
import { ecrirePosition } from './position'
import { blockProgress, buildSequence, focusStep, lastAnchorBefore, nextWorkStep } from './sequence'

const SOUND_KEY = 'renfo:player_sound'

// Overlay plein écran au-dessus de la barre du haut (1200), sous le Message (1250)
// et les feuilles (Modal MUI, 1300).
const PLAYER_Z = 1240
const PAYSAGE = '(orientation: landscape) and (max-height: 500px)'

// Avance du bip sur la fin réelle de l'étape : le son doit tomber avant la bascule.
const BIP_AVANCE_SEC = 1
const TICK_MS = 100
// Pas des boutons de réglage d'une récupération.
const PAS_REPOS_SEC = 15

// Fondu d'arrivée d'une étape (150 ms), coupé avec « Réduire les animations ».
const fondu = keyframes`from { opacity: 0; } to { opacity: 1; }`

const lireSon = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

const ecrireSon = (on) => {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  } catch {
    // Stockage indisponible : le réglage vaut pour cette séance.
  }
}

// Départ du player : depuis la position gardée (reprise au début de l'étape, sans
// sas ; un exercice chronométré démarre en pause), sinon depuis la préparation.
const departDe = (position, steps) => {
  if (!steps.length) return { cursor: 0, enPause: false, fin: true, ecoule: 0 }
  if (!position) return { cursor: 0, enPause: false, fin: false, ecoule: 0 }
  const step = steps[position.cursor]
  return {
    cursor: position.cursor,
    enPause: !position.fin && step?.kind === 'work' && step.advance === 'auto',
    fin: position.fin,
    ecoule: position.elapsedSec,
  }
}

// Dose de l'exercice d'une étape, lue dans son bloc (pour la fiche).
const doseDe = (content, step) => {
  const block = content?.blocks?.[step.blockIndex]
  const dose = exercicesDuBloc(block).find((d) => d.slug === step.slug)
    ?? { slug: step.slug, reps: step.reps, duration_sec: step.duration_sec, band_kg: step.band_kg }
  return { dose, block }
}

/**
 * Player Renfo plein écran, dans un portail sur document.body (la barre du haut de
 * l'app s'efface, `setOverlay`). Fonctionne hors ligne, sauf Ajuster.
 * - session, bands : la séance (à faire) et les élastiques du compte.
 * - beeps : créé dans le geste « Démarrer » ou « Reprendre » (contrainte iOS), libéré
 *   à la fermeture.
 * - position : de lirePosition, pour reprendre ; null pour partir du début.
 * - onSession(session) : séance renvoyée par Ajuster ; onFermer() ; onValider().
 * La position est gardée à chaque changement d'étape après la préparation, au passage
 * en arrière-plan et en quittant ; en fin de séance avec `fin: true`.
 */
const RenfoPlayer = ({ session, bands, beeps, position, onSession, onFermer, onValider }) => {
  const { setOverlay } = useAppCtx()
  const paysage = useMediaQuery(PAYSAGE)
  const { content } = session
  const titre = titreAffiche(session.title)
  const { steps, totalSeconds } = useMemo(() => buildSequence(content), [content])
  const modifiable = session.status === 'planned' && session.cycle_id == null && estNouveauFormat(content)

  const [depart] = useState(() => departDe(position, steps))
  const [cursor, setCursor] = useState(depart.cursor)
  const [fin, setFin] = useState(depart.fin)
  const [enPause, setEnPause] = useState(depart.enPause)
  // Décompte de l'étape en cours (restant en s, part écoulée), mis à jour par la boucle.
  const [affichage, setAffichage] = useState(() => ({ restant: steps[depart.cursor]?.duration_sec ?? 0, fraction: 0 }))
  // Décalage de la fin de la récupération en cours (-15 s, +15 s).
  const [decalage, setDecalage] = useState(0)
  const [ecoule, setEcoule] = useState(depart.ecoule)
  const [tempsReel, setTempsReel] = useState(depart.fin ? depart.ecoule : 0)
  const [feuille, setFeuille] = useState(null) // 'menu' | 'plan' | 'quitter'
  const [son, setSon] = useState(lireSon)

  // Début de l'étape en cours et pauses, en horloge murale.
  const ancre = useRef({ debut: 0, cumulPause: 0, pauseDepuis: 0 })
  const bipRef = useRef(false)
  const montageRef = useRef(0)
  const wakeRef = useRef(null)
  // Dernier état connu, pour les écouteurs et les réponses réseau.
  const etatRef = useRef({ cursor: depart.cursor, fin: depart.fin, tempsReel: 0, enPause: depart.enPause, steps })

  useEffect(() => {
    etatRef.current = { cursor, fin, tempsReel, enPause, steps }
  })

  useEffect(() => {
    setOverlay(true)
    return () => setOverlay(false)
  }, [setOverlay])

  // Temps passé dans le player : celui des ouvertures précédentes, plus celui-ci.
  useEffect(() => { montageRef.current = Date.now() }, [])
  const tempsEcoule = useCallback(
    () => depart.ecoule + (montageRef.current ? (Date.now() - montageRef.current) / 1000 : 0),
    [depart.ecoule],
  )

  useEffect(() => {
    if (fin) return undefined
    const id = setInterval(() => setEcoule(tempsEcoule()), 1000)
    return () => clearInterval(id)
  }, [fin, tempsEcoule])

  // ── Position gardée ────────────────────────────────────────────────────────
  // Rien pendant la préparation : quitter avant la première étape ne laisse rien.
  const garder = useCallback(() => {
    const { cursor: c, fin: f, tempsReel: t, steps: s } = etatRef.current
    if (!s.length) return
    if (f) ecrirePosition(session.id, s, { cursor: s.length - 1, elapsedSec: t, fin: true })
    else if (s[c] && s[c].kind !== 'prep') ecrirePosition(session.id, s, { cursor: c, elapsedSec: tempsEcoule() })
  }, [session.id, tempsEcoule])

  useEffect(() => {
    garder()
  }, [cursor, fin, garder])

  // ── Écran allumé, arrière-plan ─────────────────────────────────────────────
  const acquerirEcran = useCallback(async () => {
    if (!('wakeLock' in navigator)) return
    try { wakeRef.current = await navigator.wakeLock.request('screen') } catch { /* silencieux */ }
  }, [])

  useEffect(() => {
    acquerirEcran()
    const onVisibilite = () => {
      if (document.visibilityState === 'hidden') garder()
      else if (!etatRef.current.fin) acquerirEcran()
    }
    document.addEventListener('visibilitychange', onVisibilite)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilite)
      wakeRef.current?.release?.().catch(() => {})
      wakeRef.current = null
    }
  }, [acquerirEcran, garder])

  useEffect(() => () => { beeps?.dispose?.() }, [beeps])

  // ── Décompte ───────────────────────────────────────────────────────────────
  const step = fin ? null : steps[cursor]
  const travail = step?.kind === 'work'
  const auto = step?.advance === 'auto'
  const duree = (step?.duration_sec ?? 0) + (step && !travail ? decalage : 0)

  // Temps passé dans l'étape (ms), pauses déduites.
  const ecoulePas = useCallback(() => {
    const a = ancre.current
    const enCours = a.pauseDepuis ? Date.now() - a.pauseDepuis : 0
    return Date.now() - a.debut - a.cumulPause - enCours
  }, [])

  const ancrer = useCallback((pause) => {
    const now = Date.now()
    ancre.current = { debut: now, cumulPause: 0, pauseDepuis: pause ? now : 0 }
    bipRef.current = false
  }, [])

  // L'ancre se repose à chaque changement d'étape (après le rendu : la boucle de
  // l'étape d'avant est déjà arrêtée).
  useEffect(() => {
    ancrer(etatRef.current.enPause)
  }, [cursor, ancrer])

  // Aller à une étape : décompte plein, pause levée ; au-delà de la dernière, la fin.
  const aller = useCallback((idx) => {
    setEnPause(false)
    setDecalage(0)
    if (idx >= steps.length) {
      setTempsReel(Math.round(tempsEcoule()))
      setFin(true)
      return
    }
    const i = Math.max(0, idx)
    setAffichage({ restant: steps[i]?.duration_sec ?? 0, fraction: 0 })
    setCursor(i)
  }, [steps, tempsEcoule])

  useEffect(() => {
    if (fin || !auto || enPause) return undefined
    const id = setInterval(() => {
      const passe = ecoulePas() / 1000
      const reste = duree - passe
      if (reste <= BIP_AVANCE_SEC && !bipRef.current) {
        bipRef.current = true
        if (son) beeps?.play?.(travail ? 'double' : 'single')
      }
      if (reste <= 0) aller(cursor + 1)
      else setAffichage({ restant: Math.max(0, Math.ceil(reste)), fraction: Math.max(0, Math.min(1, passe / duree)) })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [fin, auto, enPause, duree, travail, son, beeps, aller, cursor, ecoulePas])

  const basculerPause = () => {
    const a = ancre.current
    if (!enPause) a.pauseDepuis = Date.now()
    else if (a.pauseDepuis) {
      a.cumulPause += Date.now() - a.pauseDepuis
      a.pauseDepuis = 0
    }
    setEnPause(!enPause)
  }

  // Décale la fin de la récupération ; le bip est réarmé si la fin s'éloigne.
  const decaler = (delta) => {
    const passe = ecoulePas() / 1000
    if (delta > 0) bipRef.current = false
    setDecalage(Math.max(decalage + delta, Math.ceil(passe) - (step?.duration_sec ?? 0)))
  }

  const suivant = () => aller(cursor + 1)
  // Précédent : l'exercice d'avant, repos sautés ; sinon la préparation.
  const precedent = () => {
    for (let i = cursor - 1; i >= 0; i--) {
      if (steps[i].kind === 'work') {
        aller(i)
        return
      }
    }
    aller(0)
  }

  // ── Fiche et Ajuster ───────────────────────────────────────────────────────
  // Séance renvoyée par Ajuster : les étapes se recalculent, l'étape reste. Exercice
  // chronométré en cours dont la durée change : décompte remis à la nouvelle durée.
  const recevoirSession = (nouvelle) => {
    onSession(nouvelle)
    const { cursor: c, fin: f, enPause: p, steps: s } = etatRef.current
    const avant = s[c]
    if (f || avant?.kind !== 'work' || avant.advance !== 'auto') return
    const apres = buildSequence(nouvelle.content).steps[c]
    if (apres && apres.duration_sec !== avant.duration_sec) {
      ancrer(p)
      setAffichage({ restant: apres.duration_sec ?? 0, fraction: 0 })
    }
  }

  const fiche = useFicheExercice({ session, bands, modifiable, sansRemplacer: true, onSession: recevoirSession })

  // Exercice chronométré en cours : le chrono se met en pause à l'ouverture de la
  // fiche et y reste à la fermeture. Pendant une pause, le décompte continue.
  const ouvrirFiche = (s) => {
    if (!s) return
    if (s === step && travail && auto && !enPause) basculerPause()
    const { dose, block } = doseDe(content, s)
    fiche.ouvrir(dose, block, s.blockIndex)
  }

  // ── Quitter ────────────────────────────────────────────────────────────────
  // Geste retour bloqué tant que la séance n'est pas finie : il ouvre la confirmation.
  const blocker = useBlocker(!fin)
  const bloque = blocker.state === 'blocked'

  const rester = () => {
    setFeuille(null)
    if (bloque) blocker.reset()
  }

  const quitter = () => {
    garder()
    setFeuille(null)
    if (bloque) blocker.proceed()
    onFermer()
  }

  const basculerSon = () => {
    ecrireSon(!son)
    setSon(!son)
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  const focus = fin ? null : focusStep(steps, cursor)
  const segments = blockProgress(steps, fin ? steps.length : cursor)
  const kgDe = (s) => (s?.exercise?.equipment.includes('band') ? bandOf(s, session.bands_used) : null)
  const suivante = step && !travail ? nextWorkStep(steps, cursor) : null
  const barreAvant = lastAnchorBefore(steps, cursor)
  const barreSuivante = suivante?.anchor && suivante.exercise?.equipment.includes('bar') ? suivante.anchor : null
  const moveBarTo = barreSuivante && barreSuivante !== barreAvant ? barreSuivante : null
  const minutes = content?.estimated_min ?? Math.round(totalSeconds / 60)

  const progression = !fin && (
    <ProgressionBlocs
      segments={segments}
      heading={focus?.heading ?? ''}
      position={positionDroite(step)}
      onOuvrir={() => setFeuille('plan')}
    />
  )

  const commandes = () => {
    if (step.kind === 'prep') {
      return <CommandesPlayer principal={{ libelle: 'Commencer', variante: 'chip', onClick: suivant }} />
    }
    if (!travail) {
      return (
        <CommandesPlayer
          disposition={paysage ? 'rangee' : 'colonne'}
          secondaires={[{ libelle: 'Précédent', onClick: precedent }]}
          principal={{ libelle: 'Passer le repos', variante: 'chip', onClick: suivant }}
        />
      )
    }
    const principal = auto
      ? { libelle: enPause ? 'Reprendre' : 'Pause', variante: enPause ? 'ink' : 'chip', onClick: basculerPause }
      : { libelle: 'Série faite', variante: 'ink', onClick: suivant }
    return (
      <CommandesPlayer
        secondaires={[{ libelle: 'Précédent', onClick: precedent }, { libelle: 'Passer', onClick: suivant }]}
        principal={principal}
      />
    )
  }

  let ecran
  if (fin) {
    ecran = (
      <EcranFin
        tempsReel={formatClock(tempsReel)}
        minutes={minutes}
        exercices={listDoses(content).filter(({ block }) => block.type === 'superset').length}
        onValider={onValider}
        onFermer={onFermer}
      />
    )
  } else if (travail) {
    ecran = (
      <EcranExercice
        step={step}
        kg={kgDe(step)}
        bands={bands}
        enPause={enPause}
        restant={auto ? affichage.restant : 0}
        fraction={affichage.fraction}
        paysage={paysage}
        onFiche={() => ouvrirFiche(step)}
        commandes={commandes()}
      />
    )
  } else {
    ecran = (
      <EcranPause
        step={step}
        restant={affichage.restant}
        fraction={affichage.fraction}
        paysage={paysage}
        onMoins={() => decaler(-PAS_REPOS_SEC)}
        onPlus={() => decaler(PAS_REPOS_SEC)}
        carte={suivante && (
          <CarteEnsuite
            step={suivante}
            kg={kgDe(suivante)}
            bands={bands}
            installation={estRecuperation(step)}
            moveBarTo={moveBarTo}
            paysage={paysage}
            onFiche={() => ouvrirFiche(suivante)}
          />
        )}
        commandes={commandes()}
      />
    )
  }

  const attente = (
    <BarreAttente place="carte" {...fiche.action.barre} sx={{ flexShrink: 0, '& .MuiCollapse-wrapperInner': { pt: space[12] } }} />
  )

  const marge = paysage ? space[24] : space[16]

  return createPortal(
    <Box
      sx={{
        position: 'fixed', inset: 0, zIndex: PLAYER_Z, bgcolor: 'background.default', color: 'ink',
        display: 'flex', flexDirection: 'column', gap: paysage ? space[12] : space[16], boxSizing: 'border-box',
        pt: `max(${paysage ? '14px' : space[16]}, env(safe-area-inset-top, 0px))`,
        pb: SPACE_BAS,
        pl: `max(${marge}, env(safe-area-inset-left, 0px))`,
        pr: `max(${marge}, env(safe-area-inset-right, 0px))`,
        overflowX: 'hidden',
        overflowY: fin ? 'auto' : 'hidden',
        overscrollBehavior: 'none',
      }}
    >
      <BandeCote cote={travail ? step.side : null} ecart={paysage ? '70px' : '150px'} />

      <Box sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <EnTetePlayer
          titre={titre}
          temps={fin ? null : formatClock(ecoule)}
          onMenu={fin ? null : () => setFeuille('menu')}
        >
          {paysage ? progression : null}
        </EnTetePlayer>
        {!paysage && progression && <Box sx={{ pt: space[16] }}>{progression}</Box>}
        {attente}
      </Box>

      <Box
        key={fin ? 'fin' : cursor}
        sx={{
          display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0,
          animation: `${fondu} ${DURATION.fade}ms ${EASE}`, ...sansMouvement(),
        }}
      >
        {ecran}
      </Box>

      <FeuilleFlottante
        ouverte={feuille === 'menu'}
        onFermer={() => setFeuille(null)}
        titre={titre}
        lignes={[
          { libelle: son ? 'Couper le son' : 'Remettre le son', onClick: basculerSon },
          { libelle: 'Voir le plan', onClick: () => setFeuille('plan') },
          { libelle: 'Quitter la séance', onClick: () => setFeuille('quitter') },
        ]}
      />

      <PlanSeance
        ouverte={feuille === 'plan'}
        onFermer={() => setFeuille(null)}
        titre={titre}
        minutes={minutes}
        content={content}
        steps={steps}
        cursor={cursor}
        fin={fin}
      />

      {/* Ouverte aussi par le geste retour bloqué. sansFermer : onFermer (rester)
          remettrait le blocker à zéro avant que quitter appelle blocker.proceed. */}
      <FeuilleFlottante
        ouverte={!fin && (feuille === 'quitter' || bloque)}
        onFermer={rester}
        titre="Tu pourras reprendre là où tu t'es arrêté."
        lignes={[{ libelle: 'Quitter la séance', onClick: quitter, sansFermer: true }]}
        fermerLibelle="Continuer"
      />

      {fiche.feuilles}
    </Box>,
    document.body,
  )
}

export default RenfoPlayer
